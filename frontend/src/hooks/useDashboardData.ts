import { useQuery } from "@tanstack/react-query";

import { fetchDashboardData } from "@/lib/api";

export function useDashboardData(months = 12) {
  return useQuery({
    queryKey: ["dashboard-data", months],
    queryFn: () => fetchDashboardData(months),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
}
