import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  tokenForgeCreditRatePerMillion,
  formatTokenForgeCreditRatePerMillion,
} from "./modelCatalogue";

export function formatRatePerMillion(rate: number) {
  return `$${rate.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
}

export function useDynamicModelPricing(tier: "payg" | "bundle" = "payg") {
  const query = trpc.public.modelPricing.useQuery({ tier }, {
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const pricingMap = useMemo(() => {
    const map = new Map<
      string,
      {
        inputRate: number;
        outputRate: number;
        isCustom: boolean;
      }
    >();
    if (query.data) {
      for (const item of query.data) {
        map.set(item.id, {
          inputRate: item.effectiveInputUsdPerMillion,
          outputRate: item.effectiveOutputUsdPerMillion,
          isCustom: item.isCustom,
        });
      }
    }
    return map;
  }, [query.data]);

  const getRates = (modelId: string, defaultInput: number, defaultOutput: number) => {
    const custom = pricingMap.get(modelId);
    if (custom && custom.isCustom) {
      return {
        inputFormatted: formatRatePerMillion(custom.inputRate),
        outputFormatted: formatRatePerMillion(custom.outputRate),
        inputRate: custom.inputRate,
        outputRate: custom.outputRate,
        isCustom: true,
        tag: "Real rate · 0% markup",
      };
    }
    if (custom) {
      return {
        inputFormatted: formatRatePerMillion(custom.inputRate),
        outputFormatted: formatRatePerMillion(custom.outputRate),
        inputRate: custom.inputRate,
        outputRate: custom.outputRate,
        isCustom: false,
        tag:
          modelId === "gpt-6-astra" || modelId === "claude-opus-5"
            ? "1:1 direct (0% markup)"
            : "2.0× included",
      };
    }
    return {
      inputFormatted: formatTokenForgeCreditRatePerMillion(defaultInput, modelId),
      outputFormatted: formatTokenForgeCreditRatePerMillion(defaultOutput, modelId),
      inputRate: tokenForgeCreditRatePerMillion(defaultInput, modelId),
      outputRate: tokenForgeCreditRatePerMillion(defaultOutput, modelId),
      isCustom: false,
      tag:
        modelId === "gpt-6-astra" || modelId === "claude-opus-5"
          ? "1:1 direct (0% markup)"
          : "2.0× included",
    };
  };

  return {
    pricingMap,
    getRates,
    isLoading: query.isLoading,
  };
}
