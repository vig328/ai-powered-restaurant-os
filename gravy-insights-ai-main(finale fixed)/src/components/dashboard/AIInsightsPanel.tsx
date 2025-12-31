import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const AIInsightsPanel = () => {
  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-ai-insights");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Insights
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div>
              <Badge className="mb-2" variant="outline">Pricing Strategy</Badge>
              <p className="text-sm text-muted-foreground">
                {insights?.pricingSuggestion || "Analyzing pricing patterns..."}
              </p>
            </div>

            <div>
              <Badge className="mb-2" variant="outline">Upsell Opportunities</Badge>
              <p className="text-sm text-muted-foreground">
                {insights?.upsellCombos || "Identifying combo opportunities..."}
              </p>
            </div>

            <div>
              <Badge className="mb-2" variant="outline">Demand Forecast</Badge>
              <p className="text-sm text-muted-foreground">
                {insights?.demandForecast || "Processing historical data..."}
              </p>
            </div>

            <div>
              <Badge className="mb-2" variant="outline">Table Optimization</Badge>
              <p className="text-sm text-muted-foreground">
                {insights?.tableOptimization || "Analyzing table utilization..."}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
