import { useQuery } from "@tanstack/react-query";

import { fetchResourceOverview } from "@/lib/api";

export function useResourceOverview(resourceCode: string, months: number = 12) {
  return useQuery({
    queryKey: ["resource-overview", resourceCode, months],
    queryFn: () => fetchResourceOverview(resourceCode, months),
    enabled: Boolean(resourceCode),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}
