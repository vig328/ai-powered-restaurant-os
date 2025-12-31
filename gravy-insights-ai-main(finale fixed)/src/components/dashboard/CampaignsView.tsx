import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Users, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const CampaignsView = () => {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-campaigns");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">AI Campaign Engine</h2>
        <p className="text-muted-foreground">Automated insights and campaign suggestions powered by AI</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-success" />
              Popular Dish Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {campaigns?.popularDishPromo || "Analyzing dish performance..."}
                </p>
                <Button size="sm" className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-info" />
              Customer Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {campaigns?.retentionStrategy || "Analyzing customer patterns..."}
                </p>
                <Button size="sm" className="w-full" variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-warning" />
              Peak Hours Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {campaigns?.peakHoursOptimization || "Analyzing booking patterns..."}
                </p>
                <Button size="sm" className="w-full" variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Improvements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Badge className="mb-2">High Cancellation Patterns</Badge>
            <p className="text-sm text-muted-foreground">
              {campaigns?.cancellationInsights || "Analyzing cancellation patterns..."}
            </p>
          </div>
          <div>
            <Badge className="mb-2">Complaint Analysis</Badge>
            <p className="text-sm text-muted-foreground">
              {campaigns?.complaintInsights || "Processing complaint data..."}
            </p>
          </div>
          <div>
            <Badge className="mb-2">Staffing Recommendations</Badge>
            <p className="text-sm text-muted-foreground">
              {campaigns?.staffingRecommendations || "Analyzing operational data..."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
