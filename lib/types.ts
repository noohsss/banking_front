export type AccountStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type CardStatus = "ACTIVE" | "SUSPENDED" | "LOST" | "REISSUED" | "CLOSED";
export type TransferStatus = "PENDING" | "SUCCESS" | "FAILED";
export type TxKind = "이체" | "입금" | "카드결제" | "자동이체";

export interface User { id: string; loginId: string; name: string; email: string; phone: string; birth?: string }

export interface Account {
  id: string;
  number: string;        // 123-4567-8901 (전체 번호; 화면에서는 maskAccount 사용)
  product: string;       // 상품명
  alias: string;         // 별칭
  balance: number;
  status: AccountStatus;
  favorite: boolean;
  dailyLimit: number;    // 기본 1,000,000
  monthlyLimit: number;  // 기본 5,000,000
  openedAt: string;      // ISO
  rate: number;          // 연 금리(%)
}

export interface Tx {
  id: string;
  accountId: string;
  at: string;            // ISO
  type: "IN" | "OUT";
  amount: number;
  balanceAfter: number;
  counterparty: string;
  memo: string;
  kind: TxKind;
}

export interface Card {
  id: string;
  accountId: string;
  last4: string;
  name: string;
  status: CardStatus;
  dailyLimit: number;
  overseas: boolean;
  issuedAt: string;
  replacedBy?: string;   // 재발급된 새 카드 id
}

export interface CardPayment { id: string; cardId: string; merchant: string; amount: number; requestedAt: string; completedAt?: string }

export interface Recipient { id: string; alias: string; number: string; name: string; favorite: boolean }

export interface Transfer {
  id: string; fromId: string; toNumber: string; toName: string; amount: number; memo: string; at: string; status: TransferStatus;
}

export interface AutoTransfer {
  id: string; fromId: string; toNumber: string; toName: string; amount: number;
  cycle: "WEEKLY" | "MONTHLY"; runDay: string; startDate: string; endDate?: string; active: boolean;
}

export interface Member extends User { password: string; pin: string }

export interface AppState {
  user: User | null;
  members: Member[];   // 이 데모에서 가입한 회원(시드 회원은 lib/seed.ts의 SEED_LOGIN)
  accounts: Account[];
  txs: Tx[];
  cards: Card[];
  payments: CardPayment[];
  recipients: Recipient[];
  transfers: Transfer[];
  autos: AutoTransfer[];
}
