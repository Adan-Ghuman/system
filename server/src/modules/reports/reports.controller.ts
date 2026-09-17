import { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service.js';

export async function exportPartyLedgerExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const partyId = typeof req.params.partyId === 'string' ? req.params.partyId : String(req.params.partyId);
    const { from, to } = req.query;

    const { workbook, filename } = await reportsService.generatePartyLedgerExcel(
      partyId,
      from ? String(from) : undefined,
      to ? String(to) : undefined
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

export async function exportDyeingReportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { millName, fabricType, from, to } = req.query;

    const { workbook, filename } = await reportsService.generateDyeingReportExcel(
      millName ? String(millName) : undefined,
      fabricType ? String(fabricType) : undefined,
      from ? String(from) : undefined,
      to ? String(to) : undefined
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

export async function exportGatePassRegisterExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, partyId, millName, from, to } = req.query;

    const passType = (String(type || 'OGP').toUpperCase() === 'IGP') ? 'IGP' : 'OGP';

    const { workbook, filename } = await reportsService.generateGatePassRegisterExcel(
      passType,
      partyId ? String(partyId) : undefined,
      millName ? String(millName) : undefined,
      from ? String(from) : undefined,
      to ? String(to) : undefined
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

export async function exportKnittingYarnExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { partyId, from, to } = req.query;

    const { workbook, filename } = await reportsService.generateKnittingYarnExcel(
      partyId ? String(partyId) : undefined,
      from ? String(from) : undefined,
      to ? String(to) : undefined
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

export async function exportMasterBalanceExcel(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { workbook, filename } = await reportsService.generateMasterBalanceExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
