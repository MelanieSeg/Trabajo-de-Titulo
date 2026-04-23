import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileCheck2, FileSpreadsheet, FileText, HardDriveDownload, ShieldCheck, Stamp } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalibrationPayload,
  createCalibration,
  downloadCertifiableReport,
  evaluateCompliance,
  exportAuditChain,
  exportAuditLogs,
  exportRawAuditableData,
  fetchCalibrations,
  fetchCertifiableReportHistory,
  fetchComplianceRequirements,
  fetchComplianceStandards,
  fetchComplianceSummary,
  fetchCalibrationCertificate,
  upsertComplianceRequirement,
  verifyAuditChainIntegrity,
} from "@/lib/api";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const nowDate = new Date();

export default function Fiscalizacion() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(nowDate.getFullYear());
  const [month, setMonth] = useState(nowDate.getMonth() + 1);

  const [calibrationForm, setCalibrationForm] = useState<CalibrationPayload>({
    meter_code: "",
    meter_name: "",
    facility_name: "",
    utility: "electricity",
    performed_by: "",
    calibrated_at: new Date().toISOString().slice(0, 16),
    valid_until: new Date(nowDate.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    notes: "",
  });

  const [requirementForm, setRequirementForm] = useState({
    code: "",
    title: "",
    utility: "electricity",
    metric_name: "electricity_kwh",
    limit_operator: "<=" as "<=" | "<" | ">=" | ">" | "==",
    limit_value: "0",
    limit_unit: "kWh",
    warning_ratio: "0.9",
    severity_on_breach: "critical" as "critical" | "warning" | "info",
    jurisdiction: "CL",
    legal_reference: "",
    standard_code: "LEGAL-LOCAL-BASE",
  });

  const standardsQuery = useQuery({
    queryKey: ["fiscalizacion-standards"],
    queryFn: () => fetchComplianceStandards(),
  });
  const requirementsQuery = useQuery({
    queryKey: ["fiscalizacion-requirements"],
    queryFn: () => fetchComplianceRequirements(true),
  });
  const complianceQuery = useQuery({
    queryKey: ["fiscalizacion-compliance", year, month],
    queryFn: () => fetchComplianceSummary(year, month),
  });
  const reportsHistoryQuery = useQuery({
    queryKey: ["fiscalizacion-report-history"],
    queryFn: () => fetchCertifiableReportHistory(12),
  });
  const calibrationsQuery = useQuery({
    queryKey: ["fiscalizacion-calibrations"],
    queryFn: () => fetchCalibrations(100),
  });
  const auditIntegrityQuery = useQuery({
    queryKey: ["fiscalizacion-audit-integrity"],
    queryFn: () => verifyAuditChainIntegrity(),
  });

  const refreshFiscalizacion = async () => {
    await queryClient.invalidateQueries({ queryKey: ["fiscalizacion-compliance"] });
    await queryClient.invalidateQueries({ queryKey: ["fiscalizacion-calibrations"] });
    await queryClient.invalidateQueries({ queryKey: ["fiscalizacion-report-history"] });
    await queryClient.invalidateQueries({ queryKey: ["fiscalizacion-audit-integrity"] });
    await queryClient.invalidateQueries({ queryKey: ["fiscalizacion-requirements"] });
  };

  const evaluateMutation = useMutation({
    mutationFn: () => evaluateCompliance(year, month),
    onSuccess: async (data) => {
      toast.success(
        `Evaluacion completada: ${data.summary.breach} incumplimientos, ${data.summary.warning} advertencias`
      );
      await refreshFiscalizacion();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo evaluar cumplimiento.");
    },
  });

  const addRequirementMutation = useMutation({
    mutationFn: () =>
      upsertComplianceRequirement({
        code: requirementForm.code,
        title: requirementForm.title,
        utility: requirementForm.utility,
        metric_name: requirementForm.metric_name,
        limit_operator: requirementForm.limit_operator,
        limit_value: Number(requirementForm.limit_value),
        limit_unit: requirementForm.limit_unit,
        warning_ratio: Number(requirementForm.warning_ratio),
        severity_on_breach: requirementForm.severity_on_breach,
        jurisdiction: requirementForm.jurisdiction || null,
        legal_reference: requirementForm.legal_reference || null,
        standard_code: requirementForm.standard_code || null,
      }),
    onSuccess: async () => {
      toast.success("Requisito legal guardado correctamente.");
      await refreshFiscalizacion();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el requisito legal.");
    },
  });

  const addCalibrationMutation = useMutation({
    mutationFn: () =>
      createCalibration({
        ...calibrationForm,
        calibrated_at: new Date(calibrationForm.calibrated_at).toISOString(),
        valid_until: new Date(calibrationForm.valid_until).toISOString(),
      }),
    onSuccess: async () => {
      toast.success("Calibracion registrada y certificado generado.");
      setCalibrationForm((prev) => ({
        ...prev,
        meter_code: "",
        meter_name: "",
        facility_name: "",
        performed_by: "",
        notes: "",
      }));
      await refreshFiscalizacion();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la calibracion.");
    },
  });

  const statusColor = (status: string) => {
    if (status === "breach") return "destructive";
    if (status === "warning") return "secondary";
    return "default";
  };

  const calibrationSummary = useMemo(() => {
    const rows = calibrationsQuery.data ?? [];
    return {
      valid: rows.filter((r) => r.status === "valid").length,
      expiring: rows.filter((r) => r.status === "expiring").length,
      expired: rows.filter((r) => r.status === "expired").length,
    };
  }, [calibrationsQuery.data]);

  const handleDownloadFormalReport = async (format: "pdf" | "xlsx") => {
    try {
      const file = await downloadCertifiableReport(format, year, month);
      triggerBlobDownload(file.blob, file.filename);
      toast.success(
        `Reporte ${format.toUpperCase()} generado. Hash: ${file.sha256Hash ?? "N/D"}`
      );
      await refreshFiscalizacion();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el reporte.");
    }
  };

  const handleExport = async (kind: "audit-logs" | "audit-chain" | "raw-data", format: string) => {
    try {
      let blob: Blob;
      if (kind === "audit-logs") blob = await exportAuditLogs(format as "csv" | "json");
      else if (kind === "audit-chain") blob = await exportAuditChain(format as "csv" | "json");
      else blob = await exportRawAuditableData(format as "json" | "zip");

      const extension = format.toLowerCase();
      const filename = `${kind}_${new Date().toISOString().slice(0, 10)}.${extension}`;
      triggerBlobDownload(blob, filename);
      toast.success("Exportacion completada.");
      await refreshFiscalizacion();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar.");
    }
  };

  const openCertificate = async (calibrationId: number) => {
    try {
      const cert = await fetchCalibrationCertificate(calibrationId);
      toast.success(`Certificado ${cert.certificate_number} | Hash ${cert.sha256_hash.slice(0, 16)}...`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo obtener el certificado.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Fiscalizacion y Cumplimiento</h2>
            <p className="text-sm text-muted-foreground">
              Reportes certificables, conformidad legal, trazabilidad auditable y calibraciones.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28"
            />
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-20"
            />
            <Button onClick={() => evaluateMutation.mutate()} disabled={evaluateMutation.isPending}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Evaluar cumplimiento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conformes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {complianceQuery.data?.summary.compliant ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Advertencias</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-yellow-600">
              {complianceQuery.data?.summary.warning ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Riesgo de infraccion</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-red-600">
              {complianceQuery.data?.summary.breach ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cadena de auditoria</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Badge variant={auditIntegrityQuery.data?.valid ? "default" : "destructive"}>
                {auditIntegrityQuery.data?.valid ? "Integra" : "Comprometida"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Bloques: {auditIntegrityQuery.data?.total_blocks ?? 0}
              </span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" />
              Reportes formales y certificables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleDownloadFormalReport("pdf")}>
                <FileText className="h-4 w-4 mr-2" />
                Generar PDF Certificable
              </Button>
              <Button variant="outline" onClick={() => handleDownloadFormalReport("xlsx")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Generar Excel Certificable
              </Button>
            </div>

            <div className="space-y-2">
              {(reportsHistoryQuery.data ?? []).slice(0, 6).map((item) => (
                <div key={item.report_code} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{item.report_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.report_code} | SHA256 {item.sha256_hash.slice(0, 20)}...
                    </p>
                  </div>
                  <Badge variant="secondary">{item.report_format.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Cumplimiento normativo y conformidad legal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(standardsQuery.data ?? []).map((standard) => (
                <Badge key={standard.code} variant="outline">
                  {standard.code} {standard.version ? `(${standard.version})` : ""}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <div className="md:col-span-2">
                <Label>Codigo</Label>
                <Input
                  value={requirementForm.code}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="CL-ELEC-MENSUAL-LIM-002"
                />
              </div>
              <div className="md:col-span-4">
                <Label>Titulo</Label>
                <Input
                  value={requirementForm.title}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Limite mensual..."
                />
              </div>
              <div>
                <Label>Utility</Label>
                <Input
                  value={requirementForm.utility}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, utility: e.target.value }))}
                />
              </div>
              <div>
                <Label>Metrica</Label>
                <Input
                  value={requirementForm.metric_name}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, metric_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Operador</Label>
                <Input
                  value={requirementForm.limit_operator}
                  onChange={(e) =>
                    setRequirementForm((prev) => ({ ...prev, limit_operator: e.target.value as "<=" | "<" | ">=" | ">" | "==" }))
                  }
                />
              </div>
              <div>
                <Label>Limite</Label>
                <Input
                  type="number"
                  value={requirementForm.limit_value}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, limit_value: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unidad</Label>
                <Input
                  value={requirementForm.limit_unit}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, limit_unit: e.target.value }))}
                />
              </div>
              <div>
                <Label>Warning ratio</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={requirementForm.warning_ratio}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, warning_ratio: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Referencia legal</Label>
                <Input
                  value={requirementForm.legal_reference}
                  onChange={(e) => setRequirementForm((prev) => ({ ...prev, legal_reference: e.target.value }))}
                  placeholder="Norma / decreto / politica interna"
                />
              </div>
              <div className="md:col-span-2 flex items-end">
                <Button onClick={() => addRequirementMutation.mutate()} disabled={addRequirementMutation.isPending}>
                  <Stamp className="h-4 w-4 mr-2" />
                  Guardar requisito
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {(complianceQuery.data?.evaluations ?? []).map((item) => (
                <div key={item.requirement_id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {item.code} - {item.title}
                    </p>
                    <Badge variant={statusColor(item.status)}>
                      {item.status.toUpperCase()} | riesgo {item.risk_level.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Observado: {item.observed_value.toFixed(2)} {item.unit} | Limite: {item.limit_operator} {item.limit_value.toFixed(2)} {item.unit}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calibracion de medidores y certificado de medicion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <Label>Codigo medidor</Label>
                <Input
                  value={calibrationForm.meter_code}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, meter_code: e.target.value }))}
                />
              </div>
              <div>
                <Label>Nombre medidor</Label>
                <Input
                  value={calibrationForm.meter_name}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, meter_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Instalacion</Label>
                <Input
                  value={calibrationForm.facility_name}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, facility_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Responsable</Label>
                <Input
                  value={calibrationForm.performed_by}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, performed_by: e.target.value }))}
                />
              </div>
              <div>
                <Label>Utility</Label>
                <Input
                  value={calibrationForm.utility}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, utility: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fecha calibracion</Label>
                <Input
                  type="datetime-local"
                  value={calibrationForm.calibrated_at}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, calibrated_at: e.target.value }))}
                />
              </div>
              <div>
                <Label>Vigente hasta</Label>
                <Input
                  type="datetime-local"
                  value={calibrationForm.valid_until}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                />
              </div>
              <div>
                <Label>Notas</Label>
                <Input
                  value={calibrationForm.notes}
                  onChange={(e) => setCalibrationForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addCalibrationMutation.mutate()} disabled={addCalibrationMutation.isPending}>
                Registrar calibracion
              </Button>
              <Badge variant="outline">Vigentes: {calibrationSummary.valid}</Badge>
              <Badge variant="outline">Por vencer: {calibrationSummary.expiring}</Badge>
              <Badge variant="outline">Expiradas: {calibrationSummary.expired}</Badge>
            </div>

            <div className="space-y-2">
              {(calibrationsQuery.data ?? []).slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {item.meter_code} - {item.meter_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.facility_name || "Sin instalacion"} | estado {item.status} | certificado {item.certificate_number || "N/D"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openCertificate(item.id)}>
                    Ver certificado
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDriveDownload className="h-4 w-4" />
              Trazabilidad completa y exportacion auditable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => handleExport("audit-logs", "csv")}>
                Logs CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport("audit-logs", "json")}>
                Logs JSON
              </Button>
              <Button variant="outline" onClick={() => handleExport("audit-chain", "csv")}>
                Cadena auditoria CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport("audit-chain", "json")}>
                Cadena auditoria JSON
              </Button>
              <Button onClick={() => handleExport("raw-data", "zip")}>
                Exportar datos crudos ZIP auditable
              </Button>
              <Button variant="outline" onClick={() => handleExport("raw-data", "json")}>
                Exportar datos crudos JSON auditable
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada exportacion registra hash SHA-256, firma digital y bloque de auditoria para trazabilidad verificable.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
