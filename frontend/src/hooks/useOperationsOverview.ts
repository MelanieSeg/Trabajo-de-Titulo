import { useQuery } from "@tanstack/react-query";

import { fetchOperationsOverview } from "@/lib/api";

export function useOperationsOverview() {
  return useQuery({
    queryKey: ["operations-overview"],
    queryFn: fetchOperationsOverview,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}
