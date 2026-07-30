"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useSubmitPrediction } from "@/features/matches/hooks/use-submit-prediction";
import type { MatchCardData } from "@/features/matches/types";

const scoreFieldSchema = z
  .string()
  .trim()
  .min(1, "Obrigatório")
  .refine((value) => /^\d+$/.test(value), "Deve ser um inteiro não negativo");

const predictSchema = z.object({
  homeScore: scoreFieldSchema,
  awayScore: scoreFieldSchema,
});

type PredictFormValues = z.infer<typeof predictSchema>;

interface PredictDialogProps {
  match: MatchCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PredictDialog({
  match,
  open,
  onOpenChange,
}: PredictDialogProps) {
  const { mutateAsync, isPending } = useSubmitPrediction();
  const form = useForm<PredictFormValues>({
    resolver: zodResolver(predictSchema),
    defaultValues: { homeScore: "", awayScore: "" },
  });
  const { reset, setError } = form;

  useEffect(() => {
    if (!open || !match) return;
    reset({
      homeScore: match.prediction
        ? String(match.prediction.predictedHomeScore)
        : "",
      awayScore: match.prediction
        ? String(match.prediction.predictedAwayScore)
        : "",
    });
  }, [open, match, reset]);

  if (!match) return null;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await mutateAsync({
        matchId: match.id,
        predictedHomeScore: Number(values.homeScore),
        predictedAwayScore: Number(values.awayScore),
      });

      if (result.ok) {
        onOpenChange(false);
        return;
      }

      setError("root", { message: result.error });
    } catch {
      setError("root", { message: "Não foi possível salvar o palpite." });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {match.homeTeamName} vs {match.awayTeamName}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <FormField
                control={form.control}
                name="homeScore"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{match.homeTeamShort}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="awayScore"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{match.awayTeamShort}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {form.formState.errors.root && (
              <p className="text-destructive text-sm">
                {form.formState.errors.root.message}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
