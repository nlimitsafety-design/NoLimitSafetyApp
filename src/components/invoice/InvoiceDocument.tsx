import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#f97316',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#f97316',
  },
  companySubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#1e3a5f',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 9,
  },
  colName: { width: '25%' },
  colShifts: { width: '10%', textAlign: 'center' },
  colHours: { width: '10%', textAlign: 'center' },
  colRate: { width: '13%', textAlign: 'right' },
  colBase: { width: '14%', textAlign: 'right' },
  colSurcharge: { width: '14%', textAlign: 'right' },
  colTotal: { width: '14%', textAlign: 'right' },
  totalsSection: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 250,
    paddingVertical: 4,
  },
  totalLabel: {
    width: 140,
    fontSize: 10,
    color: '#475569',
  },
  totalValue: {
    width: 110,
    fontSize: 10,
    textAlign: 'right',
  },
  totalRowBold: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 250,
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: '#1e3a5f',
    marginTop: 4,
  },
  totalLabelBold: {
    width: 140,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  totalValueBold: {
    width: 110,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    color: '#1e293b',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
});

interface EmployeeRow {
  employeeName: string;
  totalShifts: number;
  totalHours: number;
  hourlyRate: number;
  totalBaseAmount: number;
  totalSurchargeAmount: number;
  totalAmount: number;
}

interface InvoiceProps {
  periodStart: string;
  periodEnd: string;
  employees: EmployeeRow[];
  totals: {
    shifts: number;
    hours: number;
    baseAmount: number;
    surchargeAmount: number;
    subtotal: number;
    btw: number;
    total: number;
  };
}

function formatCurrency(amount: number): string {
  return `€ ${amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export default function InvoiceDocument({ periodStart, periodEnd, employees, totals }: InvoiceProps) {
  const today = new Date().toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>NoLimitSafety</Text>
            <Text style={styles.companySubtitle}>Beveiliging & Toezicht</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>Factuurdatum</Text>
            <Text style={styles.headerValue}>{today}</Text>
            <Text style={[styles.headerLabel, { marginTop: 8 }]}>Periode</Text>
            <Text style={styles.headerValue}>{periodStart} t/m {periodEnd}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.sectionTitle}>Overzicht diensten per medewerker</Text>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Medewerker</Text>
            <Text style={[styles.tableHeaderText, styles.colShifts]}>Diensten</Text>
            <Text style={[styles.tableHeaderText, styles.colHours]}>Uren</Text>
            <Text style={[styles.tableHeaderText, styles.colRate]}>Tarief</Text>
            <Text style={[styles.tableHeaderText, styles.colBase]}>Basis</Text>
            <Text style={[styles.tableHeaderText, styles.colSurcharge]}>Toeslag</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Totaal</Text>
          </View>
          {employees.map((emp, i) => (
            <View
              key={i}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}
            >
              <Text style={[styles.tableCell, styles.colName]}>{emp.employeeName}</Text>
              <Text style={[styles.tableCell, styles.colShifts]}>{emp.totalShifts}</Text>
              <Text style={[styles.tableCell, styles.colHours]}>{emp.totalHours.toFixed(1)}</Text>
              <Text style={[styles.tableCell, styles.colRate]}>{formatCurrency(emp.hourlyRate)}/u</Text>
              <Text style={[styles.tableCell, styles.colBase]}>{formatCurrency(emp.totalBaseAmount)}</Text>
              <Text style={[styles.tableCell, styles.colSurcharge]}>{formatCurrency(emp.totalSurchargeAmount)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(emp.totalAmount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotaal excl. BTW</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>
          {totals.surchargeAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Waarvan toeslagen</Text>
              <Text style={[styles.totalValue, { color: '#ca8a04' }]}>{formatCurrency(totals.surchargeAmount)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>BTW 21%</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals.btw)}</Text>
          </View>
          <View style={styles.totalRowBold}>
            <Text style={styles.totalLabelBold}>Totaal incl. BTW</Text>
            <Text style={styles.totalValueBold}>{formatCurrency(totals.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>NoLimitSafety — Planning & Beheer</Text>
          <Text style={styles.footerText}>Gegenereerd op {today}</Text>
        </View>
      </Page>
    </Document>
  );
}
