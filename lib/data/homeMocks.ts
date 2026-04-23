import type { Feather } from "@expo/vector-icons";

export type Range = "1D" | "1S" | "1M" | "3M" | "1A";

export const ranges: Range[] = ["1D", "1S", "1M", "3M", "1A"];

/** Variación % por rango — determina el trend y color del chart. */
export const rangeChanges: Record<Range, number> = {
  "1D": 1.96,
  "1S": 3.24,
  "1M": -2.1,
  "3M": 8.45,
  "1A": 23.7,
};

export interface ActivityItem {
  id: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  date: string;
  amount: number;
}

export const activityItems: ActivityItem[] = [
  {
    id: "1",
    icon: "check-circle",
    title: "Compra AAPL",
    date: "Hoy, 14:32",
    amount: -48240,
  },
  {
    id: "2",
    icon: "arrow-down-left",
    title: "Ingreso transferencia",
    date: "Ayer, 10:15",
    amount: 250000,
  },
  {
    id: "3",
    icon: "check-circle",
    title: "Compra AL30",
    date: "14 abr, 09:45",
    amount: -71540,
  },
  {
    id: "4",
    icon: "dollar-sign",
    title: "Dividendo AAPL",
    date: "12 abr, 16:20",
    amount: 4280,
  },
  {
    id: "5",
    icon: "arrow-up-right",
    title: "Venta parcial MSFT",
    date: "10 abr, 11:02",
    amount: 83490,
  },
];
