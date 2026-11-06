import { api, call, type components } from "./client";
import type { AutoTransfer } from "@/lib/types";

type ApiAuto = components["schemas"]["AutoTransfer"];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]; // UI runDay(매주)는 요일 한 글자, getDay() 순서
/** 서버 WEEKLY runDay: 0(월)~6(일). UI: "월".."일" */
export const weekdayToApi = (ui: string) => (WEEKDAYS.indexOf(ui) + 6) % 7;
export const weekdayFromApi = (n: number) => WEEKDAYS[(n + 1) % 7];

export const toAutoTransfer = (a: ApiAuto): AutoTransfer => ({
  id: a.id ?? "",
  fromId: a.fromAccountId ?? "",
  toNumber: a.toAccountNumMasked ?? "",
  toName: "", // 서버가 예금주를 내려주지 않는다
  amount: a.amount ?? 0,
  cycle: a.cycle ?? "MONTHLY",
  runDay: a.cycle === "WEEKLY" ? weekdayFromApi(a.runDay ?? 0) : String(a.runDay ?? 1),
  startDate: a.startDate ?? "",
  endDate: a.endDate ?? undefined,
  active: a.status === "ACTIVE",
  status: a.status,
  nextRunDate: a.nextRunDate ?? null,
});

export const listAutoTransfers = async (status?: ApiAuto["status"]) =>
  ((await call(api.GET("/auto-transfers", { params: { query: { status } } }))).items ?? []).map(toAutoTransfer);

export const createAutoTransfer = async (i: { fromId: string; toNumber: string; amount: number; cycle: "WEEKLY" | "MONTHLY"; runDay: string; startDate: string; endDate?: string; memo?: string }) =>
  toAutoTransfer(await call(api.POST("/auto-transfers", {
    body: {
      fromAccountId: i.fromId, toAccountNum: i.toNumber, amount: i.amount, cycle: i.cycle,
      runDay: i.cycle === "WEEKLY" ? weekdayToApi(i.runDay) : Number(i.runDay),
      startDate: i.startDate, endDate: i.endDate || null, memo: i.memo,
    },
  })));

export const getAutoTransfer = async (id: string) =>
  toAutoTransfer(await call(api.GET("/auto-transfers/{autoTransferId}", { params: { path: { autoTransferId: id } } })));

export const cancelAutoTransfer = async (id: string) =>
  toAutoTransfer(await call(api.DELETE("/auto-transfers/{autoTransferId}", { params: { path: { autoTransferId: id } } })));
