import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useBI } from '../context/BIContext';
import {
  ConnectorAuthType,
  ConnectorSystemType,
  ConnectorTargetModule,
  ExternalConnector,
  GovernedImportResult,
  ImportPreviewRow,
  StorageObjectRecord,
} from '../types';
import {
  MODULE_GOVERNANCE_RULES,
  governDatasetBatch,
  inspectDatasetHeaders,
  parseCsvContent,
} from '../utils/dataGovernance';
import {
  Database,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  Clock,
  RefreshCw,
  Plug,
  Webhook,
  Plus,
  Settings2,
  Trash2,
  X,
  FileUp,
  Send,
  Copy,
  Check,
  Activity,
  Cpu,
} from 'lucide-react';

export const DataManagement: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const {
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    batchImportRecords,
    auditLogs,
    selectedEditionId,
    editions,
    isDemoMode,
    resetToDemoData,
    clearDemoData,
    connectors,
    connectorLogs,
    addConnector,
    updateConnector,
    deleteConnector,
    syncConnector,
    testWebhookPush,
    warehouseStats,
    refreshWarehouseState,
    authFetch,
    saveFileToServerStorage,
  } = useBI();

  const [isRefreshingWarehouse, setIsRefreshingWarehouse] = useState(false);
  const handleRefreshWarehouse = async () => {
    setIsRefreshingWarehouse(true);
    try {
      await refreshWarehouseState();
    } finally {
      setIsRefreshingWarehouse(false);
    }
  };

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEditionObj ? currentEditionObj.name : 'Active Edition';

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'file' | 'connectors'>('file');

  // =====================================
  // File Picker & Drag-and-Drop Pipeline
  // =====================================
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetModule, setTargetModule] = useState<ConnectorTargetModule>('exhibitors');
  const [rawInputText, setRawInputText] = useState('');
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    name: string;
    sizeBytes: number;
    format: 'CSV' | 'JSON';
  } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    success: number;
    errors: number;
    duplicates: number;
    rejectedRows: GovernedImportResult['rejectedRows'];
    duplicateRows: GovernedImportResult['duplicateRows'];
    archivedObject?: StorageObjectRecord | null;
  } | null>(null);

  // =====================================
  // External API Connectors UI State
  // =====================================
  const [isConnectorModalOpen, setIsConnectorModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<ExternalConnector | null>(null);
  const [connectorForm, setConnectorForm] = useState<{
    name: string;
    systemType: ConnectorSystemType;
    mode: 'Pull (REST/CSV)' | 'Webhook Push';
    targetModule: ConnectorTargetModule;
    endpointUrl: string;
    dataPath: string;
    authType: ConnectorAuthType;
    authHeaderName: string;
    authToken: string;
    autoDeduplicate: boolean;
    description: string;
  }>({
    name: '',
    systemType: 'Custom REST',
    mode: 'Pull (REST/CSV)',
    targetModule: 'exhibitors',
    endpointUrl: '',
    dataPath: '',
    authType: 'None',
    authHeaderName: 'x-api-key',
    authToken: '',
    autoDeduplicate: true,
    description: '',
  });
  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});
  const [webhookPendingCounts, setWebhookPendingCounts] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResultBanner, setTestResultBanner] = useState<{
    connectorName: string;
    ok: boolean;
    message: string;
    samplePreview?: any[];
  } | null>(null);

  // Sample CSV templates for all 4 modules
  const sampleTemplates: Record<ConnectorTargetModule, string> = {
    exhibitors: `companyName,regNumber,sector,country,provinceCity,contactPerson,email,phone,hallStand,standSizeSqm,category,paymentStatus
"Zimbabwe Platinum Mines (Zimplats)","ZMP-ZW-1090","Mining & Natural Resources","Zimbabwe","Mashonaland West","Alex Mhembere","amhembere@zimplats.co.zw","+263 242 888 000","Hall 1 - Stand A02",140,"Local Commercial","Fully Paid"
"Tanganda Tea Company","TTC-ZW-2041","Agriculture & Food Processing","Zimbabwe","Manicaland","Timothy Ona","info@tanganda.co.zw","+263 20 645 880","Hall 2 - Stand B08",60,"Local Commercial","Fully Paid"
"Bavaria Industrial Automation GmbH","BIA-DE-9941","Heavy Engineering & Logistics","Germany","Munich","Klaus Schmidt","k.schmidt@bavaria-auto.de","+49 89 2210 900","Hall 4 - Stand INTL-11",80,"International Pavilion","Fully Paid"`,
    visitors: `fullName,category,country,cityProvince,organization,industry,email
"Chiedza Mashingaidze","Buyers and Procurement","Zimbabwe","Harare","Hippo Valley Estates","Agriculture & Food Processing","cmashingaidze@hippo.co.zw"
"Devon Govender","Investors","South Africa","Durban","Natal Industrial Growth Fund","Financial Services","devon@nigf.co.za"
"Dr. Fatima Al-Mansoor","International Delegates","United Arab Emirates","Abu Dhabi","Gulf Trade & Food Security Agency","Government","f.almansoor@gulf-trade.ae"`,
    commercial: `clientName,type,amountUsd,outstandingBalanceUsd,sector,notes
"Zimbabwe Platinum Mines (Zimplats)","Exhibition Hall Space",24500,0,"Mining & Natural Resources","Prime pavilion space invoice"
"Tanganda Tea Company","Sponsorship Agreement",12000,1500,"Agriculture & Food Processing","Agro-Summit co-sponsor"`,
    trade: `buyerOrg,buyerCountry,supplierOrg,supplierCountry,industry,opportunityType,estimatedValueUsd,engagementStatus,verificationStatus
"Hippo Valley Estates","Zimbabwe","Johannesburg Agri-Machinery Ltd","South Africa","Agriculture & Food Processing","Supply Contract",2800000,"Meeting Completed","Reported by Participant"
"Gulf Trade & Food Security Agency","United Arab Emirates","Vumba Bio-Organics & Essential Oils","Zimbabwe","Agriculture & Food Processing","Export Opportunity",4200000,"Negotiation Ongoing","Reported by Participant"`,
  };

  // Compute live Data Quality Score from real stored records
  const dataQualityScore = useMemo(() => {
    const total = exhibitors.length + visitors.length + transactions.length + tradeEngagements.length;
    if (total === 0) return '100.0%';
    let complete = 0;
    exhibitors.forEach((e) => {
      if (e.companyName && e.email && e.regNumber && e.sector) complete++;
    });
    visitors.forEach((v) => {
      if (v.fullName && v.email && v.country) complete++;
    });
    transactions.forEach((t) => {
      if (t.clientName && t.amountUsd > 0 && t.refNumber) complete++;
    });
    tradeEngagements.forEach((te) => {
      if (te.buyerOrg && te.supplierOrg && te.estimatedValueUsd > 0) complete++;
    });
    return `${((complete / total) * 100).toFixed(1)}%`;
  }, [exhibitors, visitors, transactions, tradeEngagements]);

  const connectedConnectorsCount = useMemo(
    () => connectors.filter((c) => c.status === 'Connected' || c.status === 'Syncing').length,
    [connectors]
  );

  // Poll pending webhook buffer counts when viewing Connectors tab
  const refreshWebhookBuffers = async () => {
    const webhookConnectors = connectors.filter((c) => c.mode === 'Webhook Push');
    if (webhookConnectors.length === 0) return;

    const counts: Record<string, number> = {};
    await Promise.all(
      webhookConnectors.map(async (c) => {
        try {
          const res = await authFetch(`/api/webhooks/buffer/${encodeURIComponent(c.id)}`);
          if (res.ok) {
            const data = await res.json();
            counts[c.id] = data.pendingRecords || 0;
          }
        } catch {
          // ignore silent poll error
        }
      })
    );
    setWebhookPendingCounts(counts);
  };

  useEffect(() => {
    if (activeWorkspaceTab === 'connectors') {
      refreshWebhookBuffers();
    }
  }, [activeWorkspaceTab, connectors.length]);

  // =====================================
  // File Reading & Programmatic Validation Logic
  // =====================================
  const processRawTextIntoPreview = (text: string, mod: ConnectorTargetModule, dedupEnabled = skipDuplicates) => {
    setParseError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setParseError('Please upload a file, drop a CSV/JSON file, or paste dataset records.');
      return;
    }

    let rawRecords: Record<string, any>[] = [];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (Array.isArray(parsedJson)) {
          rawRecords = parsedJson;
        } else if (Array.isArray(parsedJson?.records)) {
          rawRecords = parsedJson.records;
        } else if (Array.isArray(parsedJson?.data)) {
          rawRecords = parsedJson.data;
        } else {
          setParseError('JSON file must be an array of objects or contain a "records" / "data" array.');
          return;
        }
      } catch (err: any) {
        setParseError(`Invalid JSON syntax: ${err?.message || 'Unable to parse JSON'}`);
        return;
      }
    } else {
      const parsedCsv = parseCsvContent(trimmed);
      if (parsedCsv.records.length === 0) {
        setParseError('CSV requires a header row and at least one data row.');
        return;
      }
      rawRecords = parsedCsv.records;
    }

    const headerCheck = inspectDatasetHeaders(rawRecords, mod);
    if (!headerCheck.compatible) {
      setParseError(headerCheck.message || 'CSV schema does not match the selected module.');
      return;
    }

    const governed = governDatasetBatch(
      mod,
      rawRecords,
      { exhibitors, visitors, transactions, tradeEngagements },
      { skipDuplicates: dedupEnabled, defaultEditionId: selectedEditionId }
    );

    setPreviewRows(governed.previewRows);
    setImportStep(2);
  };

  const handleFileObject = async (file: File) => {
    setParseError(null);
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.tsv') && !lowerName.endsWith('.txt') && !lowerName.endsWith('.json')) {
      setParseError(`Unsupported file "${file.name}". Please upload a .csv, .tsv, .txt, or .json dataset.`);
      return;
    }

    try {
      const content = await file.text();
      const format = lowerName.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{') ? 'JSON' : 'CSV';
      setUploadedFileInfo({
        name: file.name,
        sizeBytes: file.size,
        format,
      });
      setRawInputText(content);
      processRawTextIntoPreview(content, targetModule);
    } catch (err: any) {
      setParseError(`Failed to read file "${file.name}": ${err?.message || 'Unknown error'}`);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileObject(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileObject(file);
    }
  };

  const handleLoadSample = (type: ConnectorTargetModule) => {
    setTargetModule(type);
    setUploadedFileInfo(null);
    setParseError(null);
    setRawInputText(sampleTemplates[type]);
  };

  const handleLoadGovernanceTestCsv = () => {
    setTargetModule('exhibitors');
    setUploadedFileInfo({ name: 'Governance_Test_Duplicates_And_Errors.csv', sizeBytes: 740, format: 'CSV' });
    setParseError(null);
    setRawInputText(`companyName,regNumber,sector,country,provinceCity,contactPerson,email,phone,hallStand,standSizeSqm,category,paymentStatus
"Matobo Solar Systems","MSS-ZW-7001","Energy & Clean Tech","Zimbabwe","Matabeleland South","Grace Nkomo","grace@matobosolar.co.zw","+263 292 770 112","Hall 3 - Stand S04",48,"SME / Emerging","Fully Paid"
"Matobo Solar Duplicate","MSS-ZW-7001","Energy & Clean Tech","Zimbabwe","Bulawayo","Duplicate Reg","dup@matobosolar.co.zw","+263 292 770 113","Hall 3 - Stand S05",36,"SME / Emerging","Fully Paid"
"Invalid Email Industries","IEI-ZW-7002","Manufacturing","Zimbabwe","Harare","Sam Banda","not-an-email","+263 242 555 000","Hall 1 - Stand B02",-10,"Local Commercial","Fully Paid"
"","MIS-ZW-7003","Commercial","Zimbabwe","Bulawayo","Missing Name","valid@missing.co.zw","+263 292 111 222","Hall 2 - Stand C01",24,"Local Commercial","InvalidStatus"`);
  };

  const downloadSampleTemplate = (type: ConnectorTargetModule) => {
    const csvContent = sampleTemplates[type];
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Template_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCommitImport = async () => {
    if (isCommitting) return;
    setIsCommitting(true);
    setParseError(null);
    try {
      // Send all parsed rows so server-side SQLite governance enforces validation & deduplication directly
      const allRawPayloads = previewRows.map((r) => r.data);
      const result = await batchImportRecords(targetModule, allRawPayloads, { skipDuplicates });

      // Archive raw uploaded dataset artifact to Server Object Storage beyond localStorage
      let archivedObject: StorageObjectRecord | null = null;
      if (rawInputText.trim()) {
        const defaultName =
          uploadedFileInfo?.name ||
          `zitf_${targetModule}_batch_${new Date().toISOString().slice(0, 10)}.csv`;
        const isJson =
          uploadedFileInfo?.format === 'JSON' ||
          rawInputText.trim().startsWith('[') ||
          rawInputText.trim().startsWith('{');
        archivedObject = await saveFileToServerStorage({
          category: isJson ? 'upload-json' : 'upload-csv',
          filename: defaultName,
          mimeType: isJson ? 'application/json' : 'text/csv',
          textContent: rawInputText,
          moduleRef: targetModule,
        });
      }

      setImportSummary({
        success: result.successCount,
        errors: result.errorCount,
        duplicates: result.duplicateCount,
        rejectedRows: result.rejectedRows || [],
        duplicateRows: result.duplicateRows || [],
        archivedObject,
      });
      setImportStep(3);
    } catch (err: any) {
      setParseError(err?.message || 'Server governance rejected the import batch.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDownloadGovernanceAuditCsv = () => {
    if (!importSummary) return;
    const rows: string[] = ['RowIndex,Outcome,Reason,PayloadPreview'];
    importSummary.duplicateRows.forEach((d) => {
      rows.push(`${d.rowIndex},"Duplicate Blocked","${d.reason.replace(/"/g, '""')}","${JSON.stringify(d.data).replace(/"/g, '""')}"`);
    });
    importSummary.rejectedRows.forEach((r) => {
      rows.push(`${r.rowIndex},"Field Validation Rejected","${r.errors.join('; ').replace(/"/g, '""')}","${JSON.stringify(r.data).replace(/"/g, '""')}"`);
    });
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZITF_Governance_Report_${targetModule}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetImport = () => {
    setImportStep(1);
    setRawInputText('');
    setUploadedFileInfo(null);
    setPreviewRows([]);
    setParseError(null);
    setImportSummary(null);
  };

  // =====================================
  // Connector Handlers
  // =====================================
  const handleSyncSingle = async (id: string) => {
    setSyncingIds((prev) => ({ ...prev, [id]: true }));
    setTestResultBanner(null);
    const result = await syncConnector(id);
    setSyncingIds((prev) => ({ ...prev, [id]: false }));
    setTestResultBanner({
      connectorName: result.connectorName,
      ok: result.status === 'Success',
      message: result.message,
    });
    await refreshWebhookBuffers();
  };

  const handleSyncAllPull = async () => {
    const pullConnectors = connectors.filter((c) => c.mode === 'Pull (REST/CSV)');
    for (const c of pullConnectors) {
      await handleSyncSingle(c.id);
    }
  };

  const handleDryRunTest = async (conn: ExternalConnector) => {
    setSyncingIds((prev) => ({ ...prev, [conn.id]: true }));
    setTestResultBanner(null);
    try {
      if (conn.mode === 'Webhook Push') {
        const res = await testWebhookPush(conn.id);
        setTestResultBanner({
          connectorName: conn.name,
          ok: res.ok,
          message: res.ok
            ? `Live HTTP POST succeeded (${res.recordsQueued} record queued in webhook buffer). Click "Flush & Import Queue" to commit.`
            : res.error || 'Webhook push failed',
        });
        await refreshWebhookBuffers();
      } else {
        const res = await authFetch('/api/connectors/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointUrl: conn.endpointUrl,
            authType: conn.authType,
            authHeaderName: conn.authHeaderName,
            authToken: conn.authToken,
            dataPath: conn.dataPath,
          }),
        });
        const payload = await res.json();
        setTestResultBanner({
          connectorName: conn.name,
          ok: Boolean(res.ok && payload.ok),
          message: payload.ok
            ? `HTTP ${payload.statusCode} OK in ${payload.latencyMs}ms · ${payload.recordsCount} records discovered (${payload.contentType})`
            : payload.error || `Endpoint check failed (HTTP ${res.status})`,
          samplePreview: payload.records?.slice(0, 2),
        });
      }
    } catch (err: any) {
      setTestResultBanner({
        connectorName: conn.name,
        ok: false,
        message: err?.message || 'Failed to test endpoint.',
      });
    } finally {
      setSyncingIds((prev) => ({ ...prev, [conn.id]: false }));
    }
  };

  const openAddConnectorModal = () => {
    setEditingConnector(null);
    setConnectorForm({
      name: '',
      systemType: 'Custom REST',
      mode: 'Pull (REST/CSV)',
      targetModule: 'exhibitors',
      endpointUrl: '',
      dataPath: '',
      authType: 'None',
      authHeaderName: 'x-api-key',
      authToken: '',
      autoDeduplicate: true,
      description: '',
    });
    setIsConnectorModalOpen(true);
  };

  const openEditConnectorModal = (conn: ExternalConnector) => {
    setEditingConnector(conn);
    setConnectorForm({
      name: conn.name,
      systemType: conn.systemType,
      mode: conn.mode,
      targetModule: conn.targetModule,
      endpointUrl: conn.endpointUrl,
      dataPath: conn.dataPath || '',
      authType: conn.authType,
      authHeaderName: conn.authHeaderName || 'x-api-key',
      authToken: conn.authToken || '',
      autoDeduplicate: conn.autoDeduplicate,
      description: conn.description || '',
    });
    setIsConnectorModalOpen(true);
  };

  const handleSaveConnector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectorForm.name.trim()) return;
    if (connectorForm.mode === 'Pull (REST/CSV)' && !connectorForm.endpointUrl.trim()) return;

    if (editingConnector) {
      updateConnector(editingConnector.id, {
        ...connectorForm,
        endpointUrl:
          connectorForm.mode === 'Webhook Push'
            ? `/api/webhooks/ingest/${editingConnector.id}`
            : connectorForm.endpointUrl.trim(),
      });
    } else {
      addConnector({
        ...connectorForm,
        endpointUrl:
          connectorForm.mode === 'Webhook Push'
            ? '/api/webhooks/ingest/custom'
            : connectorForm.endpointUrl.trim(),
        status: 'Connected',
      });
    }
    setIsConnectorModalOpen(false);
  };

  const copyWebhookCurl = (connId: string) => {
    const baseUrl = window.location.origin;
    const cmd = `curl -X POST "${baseUrl}/api/webhooks/ingest/${connId}" -H "Content-Type: application/json" -d '{"records":[{"buyerOrg":"Apex Buyer","supplierOrg":"Zim Export Co","opportunityType":"Export Opportunity","estimatedValueUsd":1200000}]}'`;
    navigator.clipboard.writeText(cmd);
    setCopiedId(connId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const previewCounts = useMemo(() => {
    const errorsCount = previewRows.filter((r) => r.errors.length > 0).length;
    const duplicatesCount = previewRows.filter((r) => r.errors.length === 0 && r.isDuplicate).length;
    const validNewCount = previewRows.filter((r) => r.errors.length === 0 && !r.isDuplicate).length;
    return { errorsCount, duplicatesCount, validNewCount };
  }, [previewRows]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Data Management &amp; Integration Centre
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
              {editionTitle}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Drag-and-drop CSV/JSON file ingestion, duplicate governance, and live REST/Webhook external API connectors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDemoMode ? (
            <button
              onClick={clearDemoData}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Clear Demo Data
            </button>
          ) : (
            <button
              onClick={resetToDemoData}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Reload Synthetic Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Centralized Server-Side SQLite Data Warehouse Telemetry */}
      <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-white">Centralized Server-Side SQLite Data Warehouse</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {warehouseStats?.engine || 'node:sqlite (WAL)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {warehouseStats?.dbPath || 'data/zitf_warehouse.db'} ·{' '}
                {warehouseStats ? `${(warehouseStats.sizeBytes / 1024).toFixed(1)} KB on disk` : 'Connecting...'} ·{' '}
                {warehouseStats ? `${warehouseStats.totalRecords.toLocaleString()} persisted rows` : '0 rows'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRefreshingWarehouse}
            onClick={handleRefreshWarehouse}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshingWarehouse ? 'animate-spin' : ''}`} />
            <span>Refresh DB Stats</span>
          </button>
        </div>

        {warehouseStats && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
            {Object.entries(warehouseStats.tableCounts).map(([tableName, rowCount]) => (
              <div
                key={tableName}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 flex items-center justify-between gap-2"
              >
                <span className="text-slate-400 font-mono truncate">{tableName}</span>
                <span className="font-bold text-amber-400 tabular-nums">{rowCount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Data Quality & Governance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Data Quality Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{dataQualityScore}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Computed across {exhibitors.length + visitors.length + transactions.length + tradeEngagements.length} active records
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Duplicate Prevention</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">Enforced</div>
          <p className="text-[11px] text-slate-500 mt-1">Unique reg no, email, invoice &amp; deal-pair check</p>
        </div>

        <div
          onClick={() => setActiveWorkspaceTab('connectors')}
          className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-amber-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Live API Connectors</span>
            <Plug className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {connectedConnectorsCount} / {connectors.length} Active
          </div>
          <p className="text-[11px] text-slate-500 mt-1">CRM, Ticketing, B2B Portal, Smart Stand</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Audit Trail Events</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{auditLogs.length} Logged</div>
          <p className="text-[11px] text-slate-500 mt-1">Every file import &amp; API sync signed</p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveWorkspaceTab('file')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold border-b-2 transition-colors cursor-pointer ${
            activeWorkspaceTab === 'file'
              ? 'border-amber-600 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileUp className="w-4 h-4 text-amber-600" />
          <span>File Picker, Drag-and-Drop &amp; Batch CSV/JSON</span>
        </button>

        <button
          onClick={() => setActiveWorkspaceTab('connectors')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold border-b-2 transition-colors cursor-pointer ${
            activeWorkspaceTab === 'connectors'
              ? 'border-amber-600 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plug className="w-4 h-4 text-amber-600" />
          <span>Live External API Connectors &amp; Webhooks ({connectors.length})</span>
        </button>
      </div>

      {/* ======================================================= */}
      {/* TAB 1: FILE PICKER, DRAG-AND-DROP & BATCH CSV/JSON      */}
      {/* ======================================================= */}
      {activeWorkspaceTab === 'file' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-sm font-bold">Batch File Upload &amp; Validation Pipeline</span>
                <p className="text-[11px] text-slate-400">
                  Drag-and-drop CSV/JSON files, validate schemas, deduplicate, and commit records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  importStep === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                Stage 1: Upload
              </span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  importStep === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                Stage 2: Validate
              </span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  importStep === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                Stage 3: Commit
              </span>
            </div>
          </div>

          <div className="p-6 text-xs">
            {/* STEP 1: Target Module + Drag-and-Drop Zone + File Picker */}
            {importStep === 1 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Destination Intelligence Module</label>
                    <select
                      value={targetModule}
                      onChange={(e) => {
                        setTargetModule(e.target.value as ConnectorTargetModule);
                        setParseError(null);
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium cursor-pointer"
                    >
                      <option value="exhibitors">Exhibitor Intelligence (Exhibitor Database)</option>
                      <option value="visitors">Visitor Intelligence (Accredited Visitors)</option>
                      <option value="commercial">Commercial Intelligence (Invoicing Ledger)</option>
                      <option value="trade">Trade Impact (B2B Matchmaking Deals)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Sample Datasets &amp; Downloadable CSV Templates
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {(['exhibitors', 'visitors', 'commercial', 'trade'] as ConnectorTargetModule[]).map((mod) => (
                        <div key={mod} className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleLoadSample(mod)}
                            className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium capitalize transition-colors cursor-pointer"
                          >
                            Load {mod}
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSampleTemplate(mod)}
                            title={`Download ${mod} CSV template`}
                            className="px-2 py-2 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-l border-slate-200 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleLoadGovernanceTestCsv}
                        className="px-2.5 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold transition-colors cursor-pointer"
                      >
                        Load Governance Test (Errors &amp; Dupes)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Programmatic Field Validation & Deduplication Policy Box */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-[11px] space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Enforced Schema Policy ({MODULE_GOVERNANCE_RULES[targetModule].label})
                      </span>
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      Client + Server SQLite Guarded
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                    <div>
                      <span className="font-semibold text-slate-600">Required Fields: </span>
                      <span className="font-mono text-slate-800">
                        {MODULE_GOVERNANCE_RULES[targetModule].requiredFields.join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Dedup Composite Keys: </span>
                      <span className="font-mono text-slate-800">
                        {MODULE_GOVERNANCE_RULES[targetModule].dedupKeys.join(' | ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Constraints: </span>
                      <span className="text-slate-700">
                        {MODULE_GOVERNANCE_RULES[targetModule].fieldRules.join(' · ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interactive Drag-and-Drop Zone & File Picker */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOver(false);
                  }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    isDraggingOver
                      ? 'border-amber-500 bg-amber-50/70 scale-[1.005]'
                      : 'border-slate-300 bg-slate-50/70 hover:border-amber-400 hover:bg-amber-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.json"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center mx-auto mb-3 text-amber-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {isDraggingOver
                      ? 'Drop file here to parse & validate'
                      : 'Drag and drop a CSV or JSON file here, or click to browse'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supports <span className="font-mono font-semibold">.csv</span>,{' '}
                    <span className="font-mono font-semibold">.tsv</span>, and{' '}
                    <span className="font-mono font-semibold">.json</span> exports from CRM, Turnstiles, or Excel
                  </p>

                  {uploadedFileInfo && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{uploadedFileInfo.name}</span>
                      <span className="font-mono text-emerald-600">
                        ({(uploadedFileInfo.sizeBytes / 1024).toFixed(1)} KB · {uploadedFileInfo.format})
                      </span>
                    </div>
                  )}
                </div>

                {parseError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Raw CSV or JSON Payload Preview / Manual Paste</label>
                    {rawInputText && (
                      <button
                        type="button"
                        onClick={handleResetImport}
                        className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        Clear Input
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={rawInputText}
                    onChange={(e) => {
                      setRawInputText(e.target.value);
                      setParseError(null);
                    }}
                    placeholder="Upload a file above or paste CSV / JSON array records here..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <span className="text-slate-400">
                    Validates required fields, numeric schemas, and checks duplicates against active database
                  </span>
                  <button
                    disabled={!rawInputText.trim()}
                    onClick={() => processRawTextIntoPreview(rawInputText, targetModule)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Parse &amp; Validate Records</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Preview, Validation & Duplicate Detection Table */}
            {importStep === 2 && (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{previewCounts.validNewCount} Valid New</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>{previewCounts.duplicatesCount} Duplicates Blocked</span>
                    </span>
                    {previewCounts.errorsCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                        <X className="w-3.5 h-3.5 text-rose-600" />
                        <span>{previewCounts.errorsCount} Schema Errors Rejected</span>
                      </span>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600"
                    />
                    <span>Enforce programmatic deduplication on commit</span>
                  </label>
                </div>

                {parseError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}

                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-80">
                  <table className="w-full text-left divide-y divide-slate-200 text-[11px]">
                    <thead className="bg-slate-50 text-slate-700 font-bold uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Row #</th>
                        {previewRows[0] &&
                          Object.keys(previewRows[0].data)
                            .slice(0, 4)
                            .map((col) => (
                              <th key={col} className="px-3 py-2">
                                {col}
                              </th>
                            ))}
                        <th className="px-3 py-2 text-right">Programmatic Governance Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={
                            row.errors.length > 0
                              ? 'bg-rose-50/40'
                              : row.isDuplicate
                              ? 'bg-amber-50/40'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="px-3 py-2 font-mono text-slate-400">#{row.rowIndex}</td>
                          {Object.keys(row.data)
                            .slice(0, 4)
                            .map((col, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 text-slate-800 max-w-xs truncate">
                                {String(row.data[col] ?? '')}
                              </td>
                            ))}
                          <td className="px-3 py-2 text-right">
                            {row.errors.length > 0 ? (
                              <div className="text-rose-700 font-bold">{row.errors.join(' | ')}</div>
                            ) : row.isDuplicate ? (
                              <div className="text-amber-700 font-bold">
                                Duplicate ({skipDuplicates ? 'Blocked' : 'Override Allowed'}): {row.duplicateReason}
                              </div>
                            ) : row.warnings.length > 0 ? (
                              <span className="text-blue-700 font-semibold">{row.warnings.join('; ')}</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">Valid New</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setImportStep(1)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
                  >
                    Back to File Input
                  </button>
                  <button
                    disabled={isCommitting || (previewCounts.validNewCount === 0 && (skipDuplicates || previewCounts.duplicatesCount === 0))}
                    onClick={handleCommitImport}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>
                      {isCommitting
                        ? 'Enforcing Server Validation...'
                        : `Confirm Server Import (${
                            skipDuplicates
                              ? previewCounts.validNewCount
                              : previewCounts.validNewCount + previewCounts.duplicatesCount
                          } Records)`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Ingestion Summary */}
            {importStep === 3 && importSummary && (
              <div className="space-y-4 py-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Server-Enforced Governed Ingestion Completed</h3>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    Committed <strong className="text-emerald-700">{importSummary.success} valid new records</strong> to the centralized SQLite{' '}
                    <strong className="capitalize">{targetModule}</strong> table.{' '}
                    {importSummary.duplicates > 0 && (
                      <span className="text-amber-700 font-semibold">Blocked {importSummary.duplicates} duplicate row(s). </span>
                    )}
                    {importSummary.errors > 0 && (
                      <span className="text-rose-700 font-semibold">Rejected {importSummary.errors} invalid row(s).</span>
                    )}
                  </p>
                  {importSummary.archivedObject && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Archived to Server Object Store: {importSummary.archivedObject.filename} ·{' '}
                        {(importSummary.archivedObject.sizeBytes / 1024).toFixed(1)} KB · SHA-256{' '}
                        {importSummary.archivedObject.sha256.slice(0, 12)}
                      </span>
                    </div>
                  )}
                </div>

                {(importSummary.rejectedRows.length > 0 || importSummary.duplicateRows.length > 0) && (
                  <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2 text-[11px] max-h-56 overflow-y-auto">
                    <div className="font-bold text-slate-800">Governance Exception Log (Server Audited)</div>
                    {importSummary.duplicateRows.map((d) => (
                      <div key={`dup-${d.rowIndex}`} className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                        <strong>Row #{d.rowIndex} (Duplicate Blocked):</strong> {d.reason}
                      </div>
                    ))}
                    {importSummary.rejectedRows.map((r) => (
                      <div key={`err-${r.rowIndex}`} className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                        <strong>Row #{r.rowIndex} (Field Validation Rejected):</strong> {r.errors.join(' | ')}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  {(importSummary.rejectedRows.length > 0 || importSummary.duplicateRows.length > 0) && (
                    <button
                      onClick={handleDownloadGovernanceAuditCsv}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Exception Audit CSV</span>
                    </button>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('mining')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-slate-950 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Analyze Imported Batch in Data Mining</span>
                    </button>
                  )}
                  <button
                    onClick={handleResetImport}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Import Another File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 2: LIVE EXTERNAL API CONNECTORS & WEBHOOKS          */}
      {/* ======================================================= */}
      {activeWorkspaceTab === 'connectors' && (
        <div className="space-y-5">
          {/* Action Header */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plug className="w-4 h-4 text-amber-600" />
                <span>External System API Connectors &amp; Real-Time Webhook Endpoints</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Execute live HTTP REST/CSV pulls via server proxy or receive real-time JSON webhook pushes into the BI warehouse.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleSyncAllPull}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Sync All Pull Feeds</span>
              </button>
              <button
                onClick={openAddConnectorModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Custom API Connector</span>
              </button>
            </div>
          </div>

          {/* Live Test / Sync Result Banner */}
          {testResultBanner && (
            <div
              className={`rounded-xl border p-4 text-xs space-y-2 ${
                testResultBanner.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold">
                  {testResultBanner.ok ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{testResultBanner.connectorName}</span>
                </div>
                <button onClick={() => setTestResultBanner(null)} className="text-slate-500 hover:text-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p>{testResultBanner.message}</p>
              {testResultBanner.samplePreview && testResultBanner.samplePreview.length > 0 && (
                <pre className="bg-slate-900 text-emerald-300 p-2.5 rounded-lg overflow-x-auto text-[10px] font-mono">
                  {JSON.stringify(testResultBanner.samplePreview, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Connector Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {connectors.map((conn) => {
              const isSyncing = Boolean(syncingIds[conn.id]);
              const isWebhook = conn.mode === 'Webhook Push';
              const pendingWebhookCount = webhookPendingCounts[conn.id] || 0;

              return (
                <div
                  key={conn.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isWebhook ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isWebhook ? <Webhook className="w-5 h-5" /> : <Plug className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-bold text-sm text-slate-900">{conn.name}</h3>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {conn.systemType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{conn.description}</p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                          conn.status === 'Error'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : conn.status === 'Syncing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {conn.status}
                      </span>
                    </div>

                    {/* Endpoint / Target Metadata */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium">Mode &amp; Target:</span>
                        <span className="font-bold text-slate-800 capitalize">
                          {conn.mode} → {conn.targetModule}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium shrink-0">
                          {isWebhook ? 'Webhook URL:' : 'Endpoint URL:'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-700 truncate">
                          {isWebhook ? `/api/webhooks/ingest/${conn.id}` : conn.endpointUrl}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium">Auth / Dedup:</span>
                        <span className="text-slate-700 font-semibold">
                          {conn.authType} · {conn.autoDeduplicate ? 'Dedup On' : 'Dedup Off'}
                        </span>
                      </div>
                      {conn.lastSyncAt && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                          <span className="text-slate-500 font-medium">Last Sync:</span>
                          <span className="font-mono text-[10px] text-slate-700">
                            {conn.lastSyncAt} ({conn.lastLatencyMs ?? 0}ms · {conn.lastSyncCount ?? 0} imported)
                          </span>
                        </div>
                      )}
                      {conn.lastError && (
                        <div className="text-rose-700 font-medium pt-1 border-t border-rose-200">
                          Error: {conn.lastError}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connector Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        disabled={isSyncing}
                        onClick={() => handleSyncSingle(conn.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>
                          {isWebhook
                            ? `Flush & Import Queue${pendingWebhookCount > 0 ? ` (${pendingWebhookCount})` : ''}`
                            : 'Sync Now'}
                        </span>
                      </button>

                      <button
                        disabled={isSyncing}
                        onClick={() => handleDryRunTest(conn)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-semibold cursor-pointer"
                      >
                        <Send className="w-3 h-3 text-amber-700" />
                        <span>{isWebhook ? 'Send Test Webhook' : 'Test Pull'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {isWebhook && (
                        <button
                          onClick={() => copyWebhookCurl(conn.id)}
                          title="Copy cURL command for external system"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          {copiedId === conn.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => openEditConnectorModal(conn)}
                        title="Configure Connector"
                        className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteConnector(conn.id)}
                        title="Remove Connector"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live API Sync Execution Log */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-sm text-slate-900">API Connector Sync Execution Log</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Real-time HTTP execution history, latency measurements, and deduplication counts
            </p>

            {connectorLogs.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                No connector syncs executed in this session yet. Click <strong>Sync Now</strong> or{' '}
                <strong>Send Test Webhook</strong> above to run a live HTTP ingestion.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Connector</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Latency</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {connectorLogs.slice(0, 8).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{log.connectorName}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'Success'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {log.status} {log.statusCode ? `(${log.statusCode})` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{log.latencyMs ?? 0} ms</td>
                        <td className="px-3 py-2 text-slate-700">{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Audit Trails */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
        <h3 className="font-bold text-sm text-slate-900 mb-1">System Data Audit Trail</h3>
        <p className="text-xs text-slate-500 mb-4">
          Chronological record of file ingestions, live API syncs, role modifications, and deal verifications
        </p>

        <div className="divide-y divide-slate-100 text-xs">
          {auditLogs.slice(0, 6).map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">{log.action}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>
              </div>
              <div className="text-right text-[11px] text-slate-400 shrink-0 ml-4">
                <div className="font-mono">{log.timestamp}</div>
                <div className="text-slate-600 font-medium">
                  {log.userEmail} · {log.userRole}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit External Connector Modal */}
      {isConnectorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold">
                {editingConnector ? 'Configure External API Connector' : 'Add Live External API Connector'}
              </span>
              <button onClick={() => setIsConnectorModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConnector} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Connector Name *</label>
                <input
                  type="text"
                  required
                  value={connectorForm.name}
                  onChange={(e) => setConnectorForm({ ...connectorForm, name: e.target.value })}
                  placeholder="e.g. ZimTrade Export Registry REST API"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">System Type</label>
                  <select
                    value={connectorForm.systemType}
                    onChange={(e) => setConnectorForm({ ...connectorForm, systemType: e.target.value as ConnectorSystemType })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="CRM">CRM</option>
                    <option value="Ticketing">Ticketing</option>
                    <option value="B2B Portal">B2B Portal</option>
                    <option value="Smart Stand">Smart Stand</option>
                    <option value="Custom REST">Custom REST</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Integration Mode</label>
                  <select
                    value={connectorForm.mode}
                    onChange={(e) =>
                      setConnectorForm({
                        ...connectorForm,
                        mode: e.target.value as 'Pull (REST/CSV)' | 'Webhook Push',
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Pull (REST/CSV)">Pull (REST/CSV)</option>
                    <option value="Webhook Push">Webhook Push</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Module</label>
                  <select
                    value={connectorForm.targetModule}
                    onChange={(e) =>
                      setConnectorForm({
                        ...connectorForm,
                        targetModule: e.target.value as ConnectorTargetModule,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  >
                    <option value="exhibitors">Exhibitors</option>
                    <option value="visitors">Visitors</option>
                    <option value="commercial">Commercial</option>
                    <option value="trade">Trade Impact</option>
                  </select>
                </div>
              </div>

              {connectorForm.mode === 'Pull (REST/CSV)' && (
                <>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      REST / CSV Endpoint URL * (HTTPS or /api/connectors/sample-feed/...)
                    </label>
                    <input
                      type="text"
                      required
                      value={connectorForm.endpointUrl}
                      onChange={(e) => setConnectorForm({ ...connectorForm, endpointUrl: e.target.value })}
                      placeholder="https://api.example.com/v1/exhibitors or /api/connectors/sample-feed/crm"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">JSON Data Path (Optional)</label>
                      <input
                        type="text"
                        value={connectorForm.dataPath}
                        onChange={(e) => setConnectorForm({ ...connectorForm, dataPath: e.target.value })}
                        placeholder="e.g. data.records or leave blank"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Authentication</label>
                      <select
                        value={connectorForm.authType}
                        onChange={(e) =>
                          setConnectorForm({ ...connectorForm, authType: e.target.value as ConnectorAuthType })
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                      >
                        <option value="None">None (Public / Internal)</option>
                        <option value="Bearer Token">Bearer Token</option>
                        <option value="API Key Header">API Key Header</option>
                      </select>
                    </div>
                  </div>

                  {connectorForm.authType !== 'None' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {connectorForm.authType === 'API Key Header' && (
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Header Name</label>
                          <input
                            type="text"
                            value={connectorForm.authHeaderName}
                            onChange={(e) => setConnectorForm({ ...connectorForm, authHeaderName: e.target.value })}
                            placeholder="x-api-key"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                          />
                        </div>
                      )}
                      <div className={connectorForm.authType === 'Bearer Token' ? 'sm:col-span-2' : ''}>
                        <label className="font-semibold text-slate-700 block mb-1">Token / Secret Key</label>
                        <input
                          type="password"
                          value={connectorForm.authToken}
                          onChange={(e) => setConnectorForm({ ...connectorForm, authToken: e.target.value })}
                          placeholder="Paste API key or Bearer token"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  value={connectorForm.description}
                  onChange={(e) => setConnectorForm({ ...connectorForm, description: e.target.value })}
                  placeholder="Brief integration scope..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={connectorForm.autoDeduplicate}
                  onChange={(e) => setConnectorForm({ ...connectorForm, autoDeduplicate: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600"
                />
                <span>Enforce duplicate prevention on sync</span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer">
                  Save Connector
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
