export interface PartyTags {
  isYarnClient: boolean;
  isKnitter: boolean;
  isFabricBuyer: boolean;
  isDyeingMill: boolean;
}

export interface PartyItem {
  _id: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  mlNo?: string;
  tags: PartyTags;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartyPayload {
  code?: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  mlNo?: string;
  tags: PartyTags;
  openingBalance: number;
}

export interface UpdatePartyPayload {
  name?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  mlNo?: string;
  tags?: Partial<PartyTags>;
  isActive?: boolean;
}
