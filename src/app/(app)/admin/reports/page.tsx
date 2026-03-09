'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useEmployees, useReports } from '@/lib/swr';
import { useDebounce } from '@/hooks/useDebounce';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { formatCurrency, calculateHours, formatDate } from '@/lib/utils';
import { ArrowDownTrayIcon, FunnelIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

interface ReportRow {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  hourlyRate: number;
  totalShifts: number;
  totalHours: number;
  totalAmount: number;
  totalBaseAmount: number;
  totalSurchargeAmount: number;
  shifts: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    type: string;
    status: string;
    hours: number;
    amount: number;
    baseAmount: number;
    surchargeAmount: number;
    surchargeDetails: { ruleName: string; hours: number; extraRate: number; amount: number }[];
  }[];
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isManager = session?.user?.role === 'MANAGER';

  // Debounce filter values to avoid fetching on every keystroke
  const debouncedStart = useDebounce(startDate, 500);
  const debouncedEnd = useDebounce(endDate, 500);
  const debouncedEmployee = useDebounce(filterEmployee, 300);
  const debouncedLocation = useDebounce(filterLocation, 300);
  const debouncedStatus = useDebounce(filterStatus, 300);

  // Build params from debounced values
  const reportParams = useMemo(() => {
    const params = new URLSearchParams({ start: debouncedStart, end: debouncedEnd });
    if (debouncedEmployee) params.set('employeeId', debouncedEmployee);
    if (debouncedLocation) params.set('location', debouncedLocation);
    if (debouncedStatus) params.set('status', debouncedStatus);
    return params;
  }, [debouncedStart, debouncedEnd, debouncedEmployee, debouncedLocation, debouncedStatus]);

  // SWR - cached & deduplicated
  const { data: reportData = [], isLoading: loading } = useReports(reportParams);
  const { data: employees = [] } = useEmployees();

  async function handleExportCSV() {
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        ...(filterEmployee && { employeeId: filterEmployee }),
        ...(filterLocation && { location: filterLocation }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await fetch(`/api/reports/export?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NoLimitSafety_Facturatie_${startDate}_${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('CSV geëxporteerd');
      } else {
        toast.error('CSV export mislukt');
      }
    } catch {
      toast.error('Export mislukt');
    }
  }

  async function handleExportExcel() {
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        ...(filterEmployee && { employeeId: filterEmployee }),
        ...(filterLocation && { location: filterLocation }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await fetch(`/api/reports/export-excel?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NoLimitSafety_Facturatie_${startDate}_${endDate}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Excel geëxporteerd');
      } else {
        toast.error('Excel export mislukt');
      }
    } catch {
      toast.error('Export mislukt');
    }
  }

  async function handleExportInvoice() {
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        ...(filterEmployee && { employeeId: filterEmployee }),
        ...(filterLocation && { location: filterLocation }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await fetch(`/api/reports/export-invoice?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NoLimitSafety_Factuur_${startDate}_${endDate}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Factuur PDF gegenereerd');
      } else {
        toast.error('Factuur genereren mislukt');
      }
    } catch {
      toast.error('Factuur genereren mislukt');
    }
  }

  // Totals
  const totalShifts = reportData.reduce((sum, r) => sum + r.totalShifts, 0);
  const totalHours = reportData.reduce((sum, r) => sum + r.totalHours, 0);
  const totalBaseAmount = reportData.reduce((sum, r) => sum + (r.totalBaseAmount || 0), 0);
  const totalSurchargeAmount = reportData.reduce((sum, r) => sum + (r.totalSurchargeAmount || 0), 0);
  const totalAmount = reportData.reduce((sum, r) => sum + r.totalAmount, 0);

  // Unique locations from shifts
  const locations = Array.from(
    new Set(reportData.flatMap((r: ReportRow) => r.shifts.map((s) => s.location)))
  );

  const columns = [
    {
      key: 'employeeName',
      header: 'Medewerker',
      render: (row: ReportRow) => (
        <div>
          <p className="font-medium text-gray-900">{row.employeeName}</p>
          <p className="text-xs text-gray-500 md:hidden">{formatCurrency(row.hourlyRate)}/u</p>
        </div>
      ),
    },
    {
      key: 'hourlyRate',
      header: 'Tarief',
      hideOnMobile: true,
      render: (row: ReportRow) => <span className="text-gray-600">{formatCurrency(row.hourlyRate)}/u</span>,
    },
    {
      key: 'totalShifts',
      header: 'Diensten',
      render: (row: ReportRow) => <span className="text-gray-900 font-medium">{row.totalShifts}</span>,
    },
    {
      key: 'totalHours',
      header: 'Uren',
      render: (row: ReportRow) => <span className="text-brand-500 font-medium">{row.totalHours.toFixed(1)}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Bedrag',
      render: (row: ReportRow) => (
        <div>
          <span className="text-green-400 font-semibold">{formatCurrency(row.totalAmount)}</span>
          {(row.totalSurchargeAmount || 0) > 0 && (
            <p className="text-xs text-yellow-500/80 mt-0.5">
              incl. {formatCurrency(row.totalSurchargeAmount)} toeslag
            </p>
          )}
        </div>
      ),
    },
  ];

  if (!isAdmin && !isManager) {
    return (
        <div className="text-center py-20">
          <p className="text-gray-400">Je hebt geen toegang tot deze pagina.</p>
        </div>
    );
  }

  return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Rapportages</h1>
            <p className="page-subtitle">Overzicht uren, kosten en facturatie</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportExcel} variant="outline" size="sm">
              <TableCellsIcon className="h-4 w-4 mr-1.5" />
              Excel exporteren
            </Button>
            <Button onClick={handleExportCSV} variant="ghost" size="sm">
              <DocumentTextIcon className="h-4 w-4 mr-1.5" />
              CSV exporteren
            </Button>
            <Button onClick={handleExportInvoice} variant="outline" size="sm">
              <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />
              Factuur genereren (PDF)
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FunnelIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-400">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              label="Van"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Tot"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Select
              label="Medewerker"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              options={[{ value: '', label: 'Alle' }, ...employees.map(e => ({ value: e.id, label: e.name }))]}
            />
            <Select
              label="Locatie"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              options={[{ value: '', label: 'Alle' }, ...locations.map(l => ({ value: l, label: l }))]}
            />
            <Select
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: '', label: 'Alle' },
                { value: 'CONCEPT', label: 'Concept' },
                { value: 'BEVESTIGD', label: 'Bevestigd' },
                { value: 'AFGEROND', label: 'Afgerond' },
              ]}
            />
          </div>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
          <Card>
            <p className="text-xs sm:text-sm text-gray-400">Totaal Diensten</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{totalShifts}</p>
          </Card>
          <Card>
            <p className="text-xs sm:text-sm text-gray-400">Totaal Uren</p>
            <p className="text-lg sm:text-2xl font-bold text-brand-500 mt-1">{totalHours.toFixed(1)}</p>
          </Card>
          <Card>
            <p className="text-xs sm:text-sm text-gray-400">Toeslagen</p>
            <p className="text-lg sm:text-2xl font-bold text-yellow-400 mt-1 truncate">{formatCurrency(totalSurchargeAmount)}</p>
          </Card>
          <Card>
            <p className="text-xs sm:text-sm text-gray-400">Totaal Bedrag</p>
            <p className="text-lg sm:text-2xl font-bold text-green-400 mt-1 truncate">{formatCurrency(totalAmount)}</p>
          </Card>
        </div>

        {/* Per-employee table */}
        <Card padding={false} className="mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Per Medewerker</h3>
          </div>
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <Table
                columns={columns}
                data={reportData}
                keyExtractor={(row) => row.employeeId}
                onRowClick={(row) => setExpandedRow(expandedRow === row.employeeId ? null : row.employeeId)}
                emptyMessage="Geen data voor deze periode"
              />
              {/* Expanded detail */}
              {expandedRow && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">
                    Detail: {(reportData as ReportRow[]).find((r: ReportRow) => r.employeeId === expandedRow)?.employeeName}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase">
                          <th className="pb-2 pr-4">Datum</th>
                          <th className="pb-2 pr-4">Tijd</th>
                          <th className="pb-2 pr-4">Locatie</th>
                          <th className="pb-2 pr-4 hidden sm:table-cell">Type</th>
                          <th className="pb-2 pr-4">Uren</th>
                          <th className="pb-2 pr-4 hidden sm:table-cell">Toeslag</th>
                          <th className="pb-2">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(reportData as ReportRow[])
                          .find((r: ReportRow) => r.employeeId === expandedRow)
                          ?.shifts.map((s) => (
                            <tr key={s.id} className="text-gray-600">
                              <td className="py-2 pr-4">{formatDate(s.date, 'dd/MM')}</td>
                              <td className="py-2 pr-4">{s.startTime}-{s.endTime}</td>
                              <td className="py-2 pr-4">{s.location}</td>
                              <td className="py-2 pr-4 hidden sm:table-cell">
                                <Badge variant="orange">{({TOEZICHT:'Toezicht',TRAINING:'Training',EVENT:'Evenement',ANDERS:'Anders'})[s.type] || s.type}</Badge>
                              </td>
                              <td className="py-2 pr-4 text-brand-500">{s.hours.toFixed(1)}</td>
                              <td className="py-2 pr-4 hidden sm:table-cell">
                                {(s.surchargeAmount || 0) > 0 ? (
                                  <span className="text-yellow-400" title={s.surchargeDetails?.map((d: any) => `${d.ruleName}: ${d.hours.toFixed(1)}u × €${d.extraRate.toFixed(2)} = €${d.amount.toFixed(2)}`).join('\n')}>
                                    {formatCurrency(s.surchargeAmount)}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </td>
                              <td className="py-2 text-green-400">{formatCurrency(s.amount)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
  );
}
