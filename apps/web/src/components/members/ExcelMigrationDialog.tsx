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
    const csvContent =
      'First Name,Last Name,Phone,Email,Gender,Plan Name,Start Date,End Date,Paid Amount,Due Amount\n' +
      'Arun,Kumar,9876543201,arun.kumar@gmail.com,MALE,Monthly General Fitness,2026-08-01,2026-09-01,2000,0\n' +
      'Deepa,Rao,9876543202,deepa.rao@yahoo.com,FEMALE,Quarterly Strength & Cardio,2026-07-15,2026-10-15,4500,0\n' +
      'Manish,Varma,9876543203,manish.v@outlook.com,MALE,Annual VIP Pass,2026-08-10,2027-08-10,10000,4000\n' +
      'Kavita,Deshmukh,9876543204,,FEMALE,Half-Yearly Transform,2026-06-01,2026-12-01,7500,0\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'gymtech_member_migration_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvText = (text: string): BulkImportMemberRow[] => {
    const lines = text
      .split(/\r\n|\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) return [];

    // Header row
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    const rows: BulkImportMemberRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV field parser handling simple quotes
      const values: string[] = [];
      let inQuotes = false;
      let currentValue = '';

      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      const getVal = (possibleHeaders: string[]): string => {
        for (const ph of possibleHeaders) {
          const idx = headers.findIndex((h) => h.includes(ph));
          if (idx !== -1 && values[idx]) return values[idx].replace(/^"|"$/g, '').trim();
        }
        return '';
      };

      const firstName = getVal(['firstname', 'first', 'fname', 'name']);
      const lastName = getVal(['lastname', 'last', 'lname', 'surname']);
      const phone = getVal(['phone', 'mobile', 'contact', 'tel']);
      const email = getVal(['email', 'mail']);
      const genderRaw = getVal(['gender', 'sex']).toUpperCase();
      const gender = genderRaw.startsWith('F') ? 'FEMALE' : genderRaw.startsWith('O') ? 'OTHER' : 'MALE';
      const planName = getVal(['plan', 'package', 'membership']);
      const startDate = getVal(['start', 'joining', 'join', 'date']);
      const endDate = getVal(['end', 'expiry', 'valid']);
      const paidRupees = parseFloat(getVal(['paid', 'amountpaid', 'fees'])) || 0;
      const dueRupees = parseFloat(getVal(['due', 'pending', 'balance'])) || 0;
      const paidPaise = Math.round(paidRupees * 100);
      const duePaise = Math.round(dueRupees * 100);

      if (firstName && phone) {
        rows.push({
          firstName,
          lastName,
          phone,
          email,
          gender,
          planName,
          startDate,
          endDate,
          paidPaise,
          duePaise,
        });
      }
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          setError('No valid member records found. Please ensure First Name and Phone columns exist.');
        } else {
          setParsedRows(parsed);
        }
      } catch (err: any) {
        setError(`Failed to read file: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setError('Could not read the uploaded file.');
    };
    reader.readAsText(file);
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
              <span>Download Sample CSV</span>
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
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Upload className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Click to browse or drop customer CSV / Excel file here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports CSV spreadsheets exported from Excel, Google Sheets, or other gym management tools
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
