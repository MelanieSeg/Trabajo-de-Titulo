import { useQuery } from "@tanstack/react-query";

import { fetchOperationsOverview } from "@/lib/api";

export function useOperationsOverview(months: number = 12) {
  return useQuery({
    queryKey: ["operations-overview", months],
    queryFn: () => fetchOperationsOverview(months),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}
