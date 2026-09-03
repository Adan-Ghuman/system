import { Party, IParty } from '../../models/Party.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult, PaginatedResult } from '../../utils/pagination.js';
import { CreatePartyInput, UpdatePartyInput, QueryPartiesInput } from './party.schema.js';

export async function generateNextPartyCode(): Promise<string> {
  const lastParty = await Party.findOne({ code: /^PRT-\d+$/ }).sort({ code: -1 });
  if (!lastParty) {
    return 'PRT-001';
  }

  const match = lastParty.code.match(/^PRT-(\d+)$/);
  if (!match) {
    return 'PRT-001';
  }

  const nextNumber = parseInt(match[1], 10) + 1;
  return `PRT-${nextNumber.toString().padStart(3, '0')}`;
}

export async function createParty(input: CreatePartyInput): Promise<IParty> {
  let code = input.code;
  if (!code) {
    code = await generateNextPartyCode();
  }

  const existing = await Party.findOne({ code });
  if (existing) {
    throw new ConflictError(`Party with code ${code} already exists`);
  }

  const party = await Party.create({
    code,
    name: input.name,
    contactPerson: input.contactPerson || '',
    phone: input.phone || '',
    address: input.address || '',
    mlNo: input.mlNo || '',
    tags: input.tags,
    openingBalance: input.openingBalance,
    currentBalance: input.openingBalance,
    isActive: true
  });

  return party;
}

export async function updateParty(id: string, input: UpdatePartyInput): Promise<IParty> {
  const party = await Party.findById(id);
  if (!party) {
    throw new NotFoundError('Party not found');
  }

  if (input.name !== undefined) party.name = input.name;
  if (input.contactPerson !== undefined) party.contactPerson = input.contactPerson;
  if (input.phone !== undefined) party.phone = input.phone;
  if (input.address !== undefined) party.address = input.address;
  if (input.mlNo !== undefined) party.mlNo = input.mlNo;
  if (input.isActive !== undefined) party.isActive = input.isActive;
  if (input.tags) {
    party.tags = {
      ...party.tags,
      ...input.tags
    };
  }

  await party.save();
  return party;
}

export async function getPartyById(id: string): Promise<IParty> {
  const party = await Party.findById(id);
  if (!party) {
    throw new NotFoundError('Party not found');
  }
  return party;
}

export async function listParties(query: QueryPartiesInput): Promise<PaginatedResult<IParty>> {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.tag) {
    filter[`tags.${query.tag}`] = true;
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { phone: searchRegex },
      { contactPerson: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    Party.find(filter)
      .sort({ code: 1 })
      .skip(skip)
      .limit(limit),
    Party.countDocuments(filter)
  ]);

  return formatPaginatedResult(items, total, page, limit);
}
