import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { BulkImportMemberRow } from '@gymtech/shared';
import * as XLSX from 'xlsx';

interface ExcelMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExcelMigrationDialog: React.FC<ExcelMigrationDialogProps> = ({ open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<BulkImportMemberRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available plans for default plan mapping
  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });
  const plans = plansData?.plans || [];

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'First Name': 'Arun',
        'Last Name': 'Kumar',
        'Phone': '9876543201',
        'Email': 'arun.kumar@gmail.com',
        'Gender': 'MALE',
        'Plan Name': 'Monthly General Fitness',
        'Start Date': '2026-08-01',
        'End Date': '2026-09-01',
        'Paid Amount': 2000,
        'Due Amount': 0,
      },
      {
        'First Name': 'Deepa',
        'Last Name': 'Rao',
        'Phone': '9876543202',
        'Email': 'deepa.rao@yahoo.com',
        'Gender': 'FEMALE',
        'Plan Name': 'Quarterly Strength & Cardio',
        'Start Date': '2026-07-15',
        'End Date': '2026-10-15',
        'Paid Amount': 4500,
        'Due Amount': 0,
      },
      {
        'First Name': 'Manish',
        'Last Name': 'Varma',
        'Phone': '9876543203',
        'Email': 'manish.v@outlook.com',
        'Gender': 'MALE',
        'Plan Name': 'Annual VIP Pass',
        'Start Date': '2026-08-10',
        'End Date': '2027-08-10',
        'Paid Amount': 10000,
        'Due Amount': 4000,
      },
      {
        'First Name': 'Kavita',
        'Last Name': 'Deshmukh',
        'Phone': '9876543204',
        'Email': '',
        'Gender': 'FEMALE',
        'Plan Name': 'Half-Yearly Transform',
        'Start Date': '2026-06-01',
        'End Date': '2026-12-01',
        'Paid Amount': 7500,
        'Due Amount': 0,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
    XLSX.writeFile(workbook, 'gymtech_member_migration_template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError('Spreadsheet file contains no worksheets.');
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        setError('No rows found in uploaded sheet. Please check the file contents.');
        return;
      }

      const rows: BulkImportMemberRow[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];

        const getVal = (possibleHeaders: string[]): string => {
          for (const key of Object.keys(raw)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const ph of possibleHeaders) {
              if (cleanKey.includes(ph)) {
                return String(raw[key] ?? '').trim();
              }
            }
          }
          return '';
        };

        const firstName = getVal(['firstname', 'first', 'fname', 'name']);
        const lastName = getVal(['lastname', 'last', 'lname', 'surname']);
        const rawPhone = getVal(['phone', 'mobile', 'contact', 'tel']);
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
        const rawEmail = getVal(['email', 'mail']);
        const cleanEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : '';
        const genderRaw = getVal(['gender', 'sex']).toUpperCase();
        const gender = genderRaw.startsWith('F') ? 'FEMALE' : genderRaw.startsWith('O') ? 'OTHER' : 'MALE';
        const planName = getVal(['plan', 'package', 'membership']);
        const startDate = getVal(['start', 'joining', 'join', 'date']);
        const endDate = getVal(['end', 'expiry', 'valid']);
        const paidRupees = parseFloat(getVal(['paid', 'amountpaid', 'fees'])) || 0;
        const dueRupees = parseFloat(getVal(['due', 'pending', 'balance'])) || 0;
        const paidPaise = Math.round(paidRupees * 100);
        const duePaise = Math.round(dueRupees * 100);

        if (firstName && cleanPhone.length === 10) {
          rows.push({
            firstName,
            lastName,
            phone: cleanPhone,
            email: cleanEmail,
            gender,
            planName,
            startDate,
            endDate,
            paidPaise,
            duePaise,
          });
        }
      }

      if (rows.length === 0) {
        setError('No valid member records found. Please ensure First Name and Phone columns exist.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setError(`Failed to read spreadsheet file: ${err.message || 'Unknown error'}`);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const res = await api.bulkImportMembers({
        members: parsedRows,
        defaultPlanId: selectedPlanId || undefined,
      });

      setImportResult({
        importedCount: res.importedCount,
        skippedCount: res.skippedCount,
        errors: res.errors,
      });

      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      setError(err.message || 'Bulk migration failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setFileName(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 rounded-md bg-card border-border shadow-2xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-sm bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                Customer Excel / CSV Migration
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Import your existing member database directly into GymTech in bulk
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
          {/* Instructions and Download Template Bar */}
          <div className="p-4 rounded-sm bg-secondary/70 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-xs text-foreground">Need the standard spreadsheet format?</span>
              <p className="text-[11px] text-muted-foreground">
                Download the verified CSV template with pre-built headers for instant mapping.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="h-8 text-xs font-semibold shrink-0 gap-1.5 border-border hover:bg-card"
            >
              <Download className="size-3.5 text-primary" />
              <span>Download Sample (.xlsx)</span>
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="rounded-sm">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* Import Success State */}
          {importResult && (
            <div className="p-4 rounded-sm bg-ok/10 border border-ok/30 flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-ok font-bold text-sm">
                <CheckCircle2 className="size-5" />
                <span>Migration Completed Successfully!</span>
              </div>
              <p className="text-xs text-foreground">
                Successfully imported <strong>{importResult.importedCount}</strong> members into your gym database.
                {importResult.skippedCount > 0 && ` (${importResult.skippedCount} skipped due to duplicates or formatting).`}
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 p-2.5 rounded bg-card/60 border border-border text-[11px] font-mono flex flex-col gap-1 max-h-32 overflow-y-auto">
                  <span className="text-muted-foreground font-semibold">Skipped Records:</span>
                  {importResult.errors.map((err, i) => (
                    <span key={i} className="text-muted-foreground">• {err}</span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={handleReset}
                  variant="outline"
                  className="text-xs h-8"
                >
                  Import Another File
                </Button>
                <Button
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="bg-primary text-primary-foreground text-xs font-bold h-8"
                >
                  Done &amp; View Roster
                </Button>
              </div>
            </div>
          )}

          {/* File Upload Zone */}
          {!importResult && parsedRows.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/60 rounded-md p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-secondary/30 hover:bg-secondary/60"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Upload className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Click to browse or drop Excel (.xlsx) / CSV file here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports Excel (.xlsx, .xls) and CSV spreadsheets exported from Excel, Google Sheets, or other gym management tools
              </p>
            </div>
          )}

          {/* Parsed Preview Table */}
          {!importResult && parsedRows.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">
                    <FileCheck className="size-3 mr-1" />
                    {fileName}
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {parsedRows.length} member records detected
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3 mr-1" /> Choose Different File
                </Button>
              </div>

              {/* Optional Default Plan Selector */}
              {plans.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-sm bg-secondary/50 border border-border text-xs">
                  <span className="font-semibold text-foreground shrink-0">Fallback Plan:</span>
                  <select
                    value={selectedPlanId ?? ''}
                    onChange={(e) => setSelectedPlanId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="h-8 px-2 rounded-xs bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:max-w-xs"
                  >
                    <option value="">Auto-match plan name or use standard default</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{((p.pricePaise + p.admissionFeePaise) / 100).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Data Table */}
              <div className="border border-border rounded-sm overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/70">
                      <TableHead className="font-mono text-[10px] uppercase">#</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase">Full Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase">Phone</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase">Email</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase">Plan / Package</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase text-right">Paid (₹)</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase text-right">Due (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-secondary/40 text-xs">
                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {row.firstName} {row.lastName}
                        </TableCell>
                        <TableCell className="font-mono text-foreground">{row.phone}</TableCell>
                        <TableCell className="font-mono text-muted-foreground text-[11px] truncate max-w-37.5">
                          {row.email || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-35">
                          {row.planName || 'Default Active Plan'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {row.paidPaise ? `₹${(row.paidPaise / 100).toLocaleString('en-IN')}` : '₹0'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-destructive">
                          {row.duePaise ? `₹${(row.duePaise / 100).toLocaleString('en-IN')}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 100 && (
                <p className="text-[11px] font-mono text-muted-foreground text-center">
                  Showing first 100 rows of {parsedRows.length} records. All rows will be imported.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>

            <Button
              disabled={parsedRows.length === 0 || isImporting}
              onClick={handleExecuteImport}
              className="bg-primary text-primary-foreground font-bold text-xs h-9 px-5 shadow-sm hover:shadow"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                  Importing {parsedRows.length} Members...
                </>
              ) : (
                <>
                  <Users className="mr-1.5 size-3.5" />
                  Migrate {parsedRows.length} Members to GymTech
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
