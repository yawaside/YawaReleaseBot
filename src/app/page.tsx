'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  XCircle, 
  History, 
  Plus, 
  Trash2, 
  Edit, 
  ExternalLink, 
  FileCode, 
  Download, 
  Upload, 
  Play, 
  AlertCircle, 
  Lock, 
  Check, 
  Clock, 
  ArrowRight, 
  FileText, 
  BookOpen,
  Info,
  ChevronRight,
  Globe
} from 'lucide-react';

const GithubIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 22v-4a4.8 4 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface SyncConfig {
  id: number;
  name: string;
  sourceRepoOwner: string;
  sourceRepoName: string;
  sourceToken: string;
  destRepoOwner: string;
  destRepoName: string;
  destToken: string;
  active: boolean;
  assetFilter: string;
  updateReadme: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  content_type: string;
  browser_download_url: string;
}

interface ReleaseComparison {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  assets: ReleaseAsset[];
  isSynced: boolean;
  destReleaseDetails: {
    id: number;
    name: string | null;
    published_at: string | null;
    assets: Array<{ id: number; name: string; size: number }>;
  } | null;
}

interface SyncLog {
  id: number;
  configId: number;
  configName: string;
  tagName: string;
  releaseName: string | null;
  status: 'success' | 'failed' | 'syncing';
  message: string | null;
  syncedAssets: string | null; // JSON string
  createdAt: string;
}

export default function Home() {
  // Configs state
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SyncConfig | null>(null);
  
  // Releases comparison state
  const [releases, setReleases] = useState<ReleaseComparison[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseComparison | null>(null);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [releasesError, setReleasesError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncOverwrite, setSyncOverwrite] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Connection test state
  const [testingSource, setTestingSource] = useState(false);
  const [testingDest, setTestingDest] = useState(false);
  const [testSourceResult, setTestSourceResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testDestResult, setTestDestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // UI Panels / Modals
  const [activeTab, setActiveTab] = useState<'sync' | 'configs' | 'logs'>('sync');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SyncConfig | null>(null);

  // Config Form fields
  const [formName, setFormName] = useState('');
  const [formSourceOwner, setFormSourceOwner] = useState('');
  const [formSourceRepo, setFormSourceRepo] = useState('');
  const [formSourceToken, setFormSourceToken] = useState('');
  const [formDestOwner, setFormDestOwner] = useState('');
  const [formDestRepo, setFormDestRepo] = useState('');
  const [formDestToken, setFormDestToken] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formAssetFilter, setFormAssetFilter] = useState('.exe');
  const [formUpdateReadme, setFormUpdateReadme] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch configs on load
  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/configs');
      const data = await res.json();
      if (Array.isArray(data)) {
        setConfigs(data);
        if (data.length > 0) {
          if (!selectedConfig) {
            setSelectedConfig(data[0]);
          }
        } else {
          // First run (fresh .exe install): open the setup tab right away
          // so the user can start configuring repositories immediately.
          setActiveTab('configs');
        }
      }
    } catch (err) {
      console.error('Error fetching configs:', err);
    }
  };

  // Fetch logs on load & when tab changes
  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadLogs();
  }, []);

  // Whenever selectedConfig changes, fetch its releases list
  useEffect(() => {
    if (selectedConfig) {
      fetchReleases(selectedConfig.id);
      setSelectedRelease(null);
    } else {
      setReleases([]);
      setSelectedRelease(null);
    }
  }, [selectedConfig]);

  const fetchReleases = async (configId: number) => {
    setIsLoadingReleases(true);
    setReleasesError(null);
    try {
      const res = await fetch(`/api/configs/${configId}/releases`);
      const data = await res.json();
      if (res.ok) {
        setReleases(data.releases || []);
        if (data.sourceError) {
          setReleasesError(`Ошибка источника: ${data.sourceError}`);
        } else if (data.destError) {
          setReleasesError(`Предупреждение назначения: ${data.destError}`);
        }
      } else {
        setReleasesError(data.error || 'Не удалось загрузить релизы');
      }
    } catch (err: any) {
      setReleasesError(err.message || 'Ошибка загрузки релизов');
    } finally {
      setIsLoadingReleases(false);
    }
  };

  // Test source connection in form
  const testConnection = async (type: 'source' | 'dest') => {
    const isSource = type === 'source';
    const token = isSource ? formSourceToken : formDestToken;
    const owner = isSource ? formSourceOwner : formDestOwner;
    const repo = isSource ? formSourceRepo : formDestRepo;

    if (!token || !owner || !repo) {
      const errorMsg = 'Заполните Владельца, Репозиторий и Токен для проверки';
      if (isSource) setTestSourceResult({ success: false, message: errorMsg });
      else setTestDestResult({ success: false, message: errorMsg });
      return;
    }

    if (isSource) {
      setTestingSource(true);
      setTestSourceResult(null);
    } else {
      setTestingDest(true);
      setTestDestResult(null);
    }

    try {
      const res = await fetch('/api/configs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, owner, repo })
      });
      const data = await res.json();
      if (isSource) {
        setTestSourceResult({ success: data.success, message: data.message });
      } else {
        setTestDestResult({ success: data.success, message: data.message });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Сбой при проверке связи';
      if (isSource) {
        setTestSourceResult({ success: false, message: errorMsg });
      } else {
        setTestDestResult({ success: false, message: errorMsg });
      }
    } finally {
      if (isSource) setTestingSource(false);
      else setTestingDest(false);
    }
  };

  // Save Config (Create or Edit)
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName || !formSourceOwner || !formSourceRepo || !formSourceToken || !formDestOwner || !formDestRepo || !formDestToken) {
      setFormError('Пожалуйста, заполните все обязательные поля формы.');
      return;
    }

    const payload = {
      name: formName,
      sourceRepoOwner: formSourceOwner,
      sourceRepoName: formSourceRepo,
      sourceToken: formSourceToken,
      destRepoOwner: formDestOwner,
      destRepoName: formDestRepo,
      destToken: formDestToken,
      active: formActive,
      assetFilter: formAssetFilter,
      updateReadme: formUpdateReadme
    };

    try {
      let res;
      if (editingConfig) {
        res = await fetch(`/api/configs/${editingConfig.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Не удалось сохранить настройки');
        return;
      }

      // Refresh configs list
      await loadConfigs();
      
      // If we were editing the selected one, update it in state too
      if (editingConfig && selectedConfig?.id === editingConfig.id) {
        setSelectedConfig(data);
      } else if (!selectedConfig) {
        setSelectedConfig(data);
      }

      // Reset & Close Modal
      setIsConfigModalOpen(false);
      setEditingConfig(null);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Произошла непредвиденная ошибка');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSourceOwner('');
    setFormSourceRepo('');
    setFormSourceToken('');
    setFormDestOwner('');
    setFormDestRepo('');
    setFormDestToken('');
    setFormActive(true);
    setFormAssetFilter('.exe');
    setFormUpdateReadme(true);
    setFormError(null);
    setTestSourceResult(null);
    setTestDestResult(null);
  };

  const handleEditConfig = (config: SyncConfig) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormSourceOwner(config.sourceRepoOwner);
    setFormSourceRepo(config.sourceRepoName);
    setFormSourceToken(config.sourceToken);
    setFormDestOwner(config.destRepoOwner);
    setFormDestRepo(config.destRepoName);
    setFormDestToken(config.destToken);
    setFormActive(config.active);
    setFormAssetFilter(config.assetFilter ?? '.exe');
    setFormUpdateReadme(config.updateReadme ?? true);
    
    setFormError(null);
    setTestSourceResult(null);
    setTestDestResult(null);
    setIsConfigModalOpen(true);
  };

  const handleDeleteConfig = async (configId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту конфигурацию? Связанная история логов также сотрется.')) {
      return;
    }

    try {
      const res = await fetch(`/api/configs/${configId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const nextConfigs = configs.filter(c => c.id !== configId);
        setConfigs(nextConfigs);
        if (selectedConfig?.id === configId) {
          setSelectedConfig(nextConfigs.length > 0 ? nextConfigs[0] : null);
        }
        loadLogs();
      } else {
        alert('Не удалось удалить конфигурацию');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении');
    }
  };

  // Trigger synchronization for selected release
  const handleSyncRelease = async (release: ReleaseComparison) => {
    if (!selectedConfig) return;
    
    const filterLabel = selectedConfig.assetFilter?.trim() || 'все файлы';
    const matchingCount = countMatchingAssets(release, selectedConfig.assetFilter);
    const confirmMsg = `Синхронизировать релиз ${release.tag_name} в репозиторий назначения?\n\n` +
      `• Тег и версия останутся идентичными: ${release.tag_name}\n` +
      `• Фильтр файлов: ${filterLabel}\n` +
      `• Подходящих файлов к загрузке: ${matchingCount} из ${release.assets.length}\n` +
      `• README.md ${selectedConfig.updateReadme ? 'будет обновлён' : 'НЕ будет обновлён'} на основе changelog\n\n` +
      `Исходный код (.zip/.tar.gz репозитория) переноситься не будет.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg('Подключение к шлюзам GitHub, подготовка файлов...');
    
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: selectedConfig.id,
          tagName: release.tag_name,
          overwrite: syncOverwrite
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const syncedN = data.syncedAssets?.length ?? 0;
        const skippedN = data.skippedAssets?.length ?? 0;
        alert(
          `Релиз ${release.tag_name} успешно перенесён!\n\n` +
          `• Загружено файлов: ${syncedN}\n` +
          `• Пропущено фильтром: ${skippedN}\n` +
          `• README обновлён: ${data.readmeUpdated ? 'да' : 'нет'}`
        );
        
        // Refresh local release comparison to show newly synced state
        await fetchReleases(selectedConfig.id);
        
        // Update selected release details in preview card
        if (selectedRelease?.tag_name === release.tag_name) {
          const updated = releases.find(r => r.tag_name === release.tag_name);
          if (updated) setSelectedRelease(updated);
        }

        // Reload logs
        loadLogs();
      } else {
        alert(`Ошибка переноса релиза: ${data.message || data.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: any) {
      alert(`Сбой сетевого запроса: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
      setSyncStatusMsg(null);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Вы уверены, что хотите полностью очистить историю логов в базе данных?')) {
      return;
    }
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      if (res.ok) {
        setLogs([]);
      }
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  // Asset filter utilities (mirror of server-side logic)
  const parseFilter = (filter: string | undefined): string[] => {
    if (!filter || !filter.trim()) return [];
    return filter
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
      .map(e => (e.startsWith('.') ? e : `.${e}`));
  };

  const assetMatches = (fileName: string, filter: string | undefined): boolean => {
    const exts = parseFilter(filter);
    if (exts.length === 0) return true;
    const lower = fileName.toLowerCase();
    return exts.some(ext => lower.endsWith(ext));
  };

  const countMatchingAssets = (release: ReleaseComparison, filter: string | undefined): number => {
    return release.assets.filter(a => assetMatches(a.name, filter)).length;
  };

  // Formatting utilities
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-6 py-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-500/10">
              <GitBranch className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
                <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Yawa</span>
                <span className="relative inline-flex items-center px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
                  Release
                </span>
                <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Bot</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal border border-indigo-500/30">v1.4</span>
              </h1>
              <p className="text-xs text-slate-400">Автоматическая синхронизация changelog и бинарных файлов релизов между аккаунтами без исходного кода</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
                activeTab === 'sync'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Синхронизация
            </button>
            <button
              onClick={() => setActiveTab('configs')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
                activeTab === 'configs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Подключения ({configs.length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Логи ({logs.length})
            </button>
          </div>
        </div>
      </header>

      {/* QUICK STATS SUB-BAR */}
      <section className="bg-slate-950/40 border-b border-slate-800/60 py-3 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-400">Режим работы:</span>
            <span className="font-mono text-emerald-400 font-semibold">Локальный (ПК)</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
            <Settings className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-slate-400">Конфигураций:</span>
            <span className="font-mono text-slate-200 font-semibold">{configs.length}</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-400">Успешных переносов:</span>
            <span className="font-mono text-emerald-400 font-semibold">{logs.filter(l => l.status === 'success').length}</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-slate-400">Ошибок в логах:</span>
            <span className="font-mono text-rose-400 font-semibold">{logs.filter(l => l.status === 'failed').length}</span>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 gap-6">

        {/* ----------------- TAB 1: SYNC & COMPARE RELEASES ----------------- */}
        {activeTab === 'sync' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Pipelines Selector & Config short list */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-indigo-400" />
                    Выбор конвейера
                  </h3>
                  <button 
                    onClick={() => { setEditingConfig(null); resetForm(); setIsConfigModalOpen(true); }}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
                    title="Создать новое подключение"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {configs.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 px-2">
                    <p className="mb-3 text-xs">Нет активных конфигураций</p>
                    <button
                      onClick={() => { setEditingConfig(null); resetForm(); setIsConfigModalOpen(true); }}
                      className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg text-xs font-medium border border-indigo-500/20 transition-all"
                    >
                      Создать первое подключение
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {configs.map((cfg) => (
                      <button
                        key={cfg.id}
                        onClick={() => setSelectedConfig(cfg)}
                        className={`text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1.5 ${
                          selectedConfig?.id === cfg.id
                            ? 'bg-indigo-600/10 border-indigo-500/60 shadow-inner'
                            : 'bg-slate-900 hover:bg-slate-800/80 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-100 truncate max-w-[180px]">{cfg.name}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 font-mono">FROM</span>
                            <span className="truncate">{cfg.sourceRepoOwner}/{cfg.sourceRepoName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 font-mono">TO_DST</span>
                            <span className="truncate">{cfg.destRepoOwner}/{cfg.destRepoName}</span>
                          </div>
                        </div>

                        {cfg.lastSyncAt && (
                          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/40 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Синхронизировано: {formatDate(cfg.lastSyncAt)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bot Guide / Rules */}
              <div className="bg-slate-950/30 border border-slate-800/60 rounded-xl p-4 text-xs space-y-3">
                <h4 className="font-semibold text-slate-300 flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-500" />
                  Принцип работы бота
                </h4>
                <ul className="space-y-2 text-slate-400 list-disc list-inside">
                  <li>Загружает релизные метаданные (тег, название, changelog) из приватного репозитория-источника.</li>
                  <li>Получает и скачивает во временный буфер все бинарные ассеты релиза (архивы, exe, dmg и т.д.).</li>
                  <li>Создает чистый релиз в репозитории назначения от имени 2-го аккаунта.</li>
                  <li>Заливает скачанные файлы в новый релиз. Исходный код репозитория остается защищенным и не переносится.</li>
                </ul>
              </div>
            </div>

            {/* Releases comparison lists */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              {!selectedConfig ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center py-20">
                  <GitBranch className="h-12 w-12 text-slate-700 mb-3" />
                  <h3 className="text-base font-semibold text-slate-300">Репозиторий не выбран</h3>
                  <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                    Выберите существующий конвейер синхронизации из списка слева или добавьте новый, чтобы просмотреть доступные релизы.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                  
                  {/* Current pipeline info header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Активный конвейер</span>
                      <h2 className="text-base font-bold text-slate-100">{selectedConfig.name}</h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3 text-slate-500" />
                          Источник: <strong className="text-slate-300 font-mono">{selectedConfig.sourceRepoOwner}/{selectedConfig.sourceRepoName}</strong>
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="flex items-center gap-1">
                          <GithubIcon className="h-3 w-3 text-slate-500" />
                          Назначение: <strong className="text-indigo-300 font-mono">{selectedConfig.destRepoOwner}/{selectedConfig.destRepoName}</strong>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => fetchReleases(selectedConfig.id)}
                      disabled={isLoadingReleases}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-2 self-start sm:self-center transition-all"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isLoadingReleases ? 'animate-spin' : ''}`} />
                      Обновить списки
                    </button>
                  </div>

                  {/* Sync Action bar & option */}
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={syncOverwrite}
                          onChange={(e) => setSyncOverwrite(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 h-4 w-4"
                        />
                        <span>Принудительно перезаписывать существующий релиз в ресивере</span>
                      </label>
                    </div>
                    <div className="text-slate-400 text-[11px] bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                      Перезапись удалит старый релиз на GitHub (вместе с тегом) и создаст заново с новыми файлами.
                    </div>
                  </div>

                  {releasesError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs flex items-center gap-2.5">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <div>{releasesError}</div>
                    </div>
                  )}

                  {/* Releases lists & details */}
                  {isLoadingReleases ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                      <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin mb-3" />
                      <p className="text-xs text-slate-400">Опрашиваем GitHub репозитории {selectedConfig.sourceRepoOwner}/{selectedConfig.sourceRepoName}...</p>
                    </div>
                  ) : releases.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
                      <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-medium">Релизы в репозитории источника не найдены</p>
                      <p className="text-[11px] text-slate-500 mt-1">Убедитесь, что вы создали хотя бы один черновик или опубликованный релиз в исходном GitHub репозитории.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      
                      {/* Left: Release list */}
                      <div className="md:col-span-6 flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Доступные релизы ({releases.length})</span>
                        {releases.map((rel) => {
                          const isSelected = selectedRelease?.tag_name === rel.tag_name;
                          return (
                            <div
                              key={rel.tag_name}
                              onClick={() => setSelectedRelease(rel)}
                              className={`p-3 rounded-lg border transition-all cursor-pointer text-xs ${
                                isSelected 
                                  ? 'bg-slate-800 border-indigo-500' 
                                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-bold text-slate-100 truncate">
                                  {rel.name || rel.tag_name}
                                </div>
                                <span className="font-mono text-[10px] text-indigo-400 font-semibold shrink-0 bg-slate-950 px-1.5 py-0.5 rounded">
                                  {rel.tag_name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
                                <span>{formatDate(rel.published_at || rel.created_at)}</span>
                                <span className="text-slate-600">•</span>
                                <span className="flex items-center gap-0.5 text-slate-300">
                                  <FileCode className="h-3 w-3 text-slate-500" /> {rel.assets.length} файлов
                                </span>
                              </div>

                              {/* Synced vs Non-synced status badge */}
                              <div className="mt-2.5 flex items-center justify-between">
                                {rel.isSynced ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                                    <Check className="h-3 w-3" /> Синхронизирован
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20">
                                    <AlertCircle className="h-3 w-3" /> Отсутствует на приемнике
                                  </span>
                                )}

                                <span className="text-[11px] text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-0.5">
                                  Детали <ChevronRight className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Release detailed preview and action */}
                      <div className="md:col-span-6 flex flex-col">
                        {selectedRelease ? (
                          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col gap-4 h-full">
                            
                            {/* Release Title and Actions */}
                            <div className="pb-3 border-b border-slate-800">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-bold text-slate-100 text-sm">
                                  {selectedRelease.name || selectedRelease.tag_name}
                                </h3>
                                <span className="text-xs text-slate-400 font-mono">
                                  {selectedRelease.tag_name}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">Создан: {formatDate(selectedRelease.created_at)}</p>

                              {/* Sync button trigger */}
                              <div className="mt-3">
                                <button
                                  onClick={() => handleSyncRelease(selectedRelease)}
                                  disabled={isSyncing}
                                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  {isSyncing ? (
                                    <>
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                      Синхронизируем...
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3.5 w-3.5" />
                                      Запустить синхронизацию релиза
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Syncing Overlay */}
                            {isSyncing && (
                              <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs space-y-1 animate-pulse">
                                <div className="font-semibold flex items-center gap-1.5">
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  Процесс переноса активов активен
                                </div>
                                <p className="text-[11px] text-slate-400">Бот локально скачивает ассеты релиза и отправляет их в целевой репозиторий. Пожалуйста, не закрывайте страницу.</p>
                              </div>
                            )}

                            {/* Release assets list */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Бинарные файлы релиза ({selectedRelease.assets.length})</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                                  Фильтр: {selectedConfig?.assetFilter?.trim() || 'все'}
                                </span>
                              </div>
                              {selectedRelease.assets.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">Ассеты отсутствуют. Будет перенесен только changelog.</p>
                              ) : (
                                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                  {selectedRelease.assets.map((asset) => {
                                    const matches = assetMatches(asset.name, selectedConfig?.assetFilter);
                                    return (
                                      <div key={asset.id} className={`flex items-center justify-between p-2 rounded border text-[11px] ${
                                        matches
                                          ? 'bg-slate-950/60 border-slate-800/80'
                                          : 'bg-slate-950/30 border-slate-800/40 opacity-50'
                                      }`}>
                                        <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                                          {matches ? (
                                            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                                          ) : (
                                            <XCircle className="h-3 w-3 text-slate-600 shrink-0" />
                                          )}
                                          <span className={`font-mono truncate ${matches ? 'text-slate-200' : 'text-slate-500 line-through'}`} title={asset.name}>
                                            {asset.name}
                                          </span>
                                        </span>
                                        <span className="text-slate-500 font-mono shrink-0">
                                          {formatBytes(asset.size)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[10px] text-slate-500 mt-1.5">
                                Будет загружено: <strong className="text-emerald-400">{countMatchingAssets(selectedRelease, selectedConfig?.assetFilter)}</strong> из {selectedRelease.assets.length} файлов.
                                {selectedConfig?.updateReadme && ' README.md будет обновлён из changelog.'}
                              </p>
                            </div>

                            {/* Destination comparison if synced */}
                            {selectedRelease.isSynced && selectedRelease.destReleaseDetails && (
                              <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg text-xs text-slate-300">
                                <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Обнаружен в ресивере
                                </h4>
                                <div className="space-y-1 text-[11px] text-slate-400">
                                  <p>ID релиза в приемнике: <strong className="text-slate-300 font-mono">{selectedRelease.destReleaseDetails.id}</strong></p>
                                  <p>Опубликовано: {formatDate(selectedRelease.destReleaseDetails.published_at)}</p>
                                  <p>Файлов в приемнике: <strong className="text-slate-300">{selectedRelease.destReleaseDetails.assets.length}</strong> шт.</p>
                                </div>
                              </div>
                            )}

                            {/* Changelog body */}
                            <div className="flex-1 flex flex-col">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Описание / Changelog ({selectedRelease.body?.length || 0} символов)
                              </span>
                              <div className="flex-1 p-2 bg-slate-950/90 rounded border border-slate-800/80 font-mono text-[10px] text-slate-300 overflow-y-auto max-h-[180px] whitespace-pre-wrap">
                                {selectedRelease.body || 'Описание релиза отсутствует'}
                              </div>
                            </div>

                          </div>
                        ) : (
                          <div className="bg-slate-900/40 rounded-xl border border-slate-800 border-dashed p-10 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                            <BookOpen className="h-8 w-8 text-slate-700 mb-2" />
                            <p className="text-xs text-slate-500">Выберите релиз из списка слева, чтобы посмотреть его описание, список прикрепленных файлов и запустить перенос.</p>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        )}


        {/* ----------------- TAB 2: PIPELINES / CONFIGS MANAGEMENT ----------------- */}
        {activeTab === 'configs' && (
          <div className="space-y-6">
            
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100">Конвейеры синхронизации</h2>
                <p className="text-xs text-slate-400">Настройка связей между закрытым исходным репозиторием и публичным ресивером</p>
              </div>
              <button
                onClick={() => { setEditingConfig(null); resetForm(); setIsConfigModalOpen(true); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white flex items-center gap-2 transition-all"
              >
                <Plus className="h-4 w-4" />
                Добавить подключение
              </button>
            </div>

            {/* Configs Table / Cards */}
            {configs.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-12 text-center max-w-xl mx-auto">
                <Settings className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">Список подключений пуст</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">Настройте учетные данные и репозитории, чтобы бот мог считывать закрытые релизы и переносить их.</p>
                <button
                  onClick={() => { setEditingConfig(null); resetForm(); setIsConfigModalOpen(true); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                >
                  Создать подключение
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {configs.map((config) => (
                  <div key={config.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between gap-4">
                    
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                            {config.name}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-normal ${
                              config.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {config.active ? 'Активен' : 'Отключен'}
                            </span>
                          </h3>
                          <span className="text-[10px] text-slate-500">Добавлен: {formatDate(config.createdAt)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditConfig(config)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                            title="Редактировать"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteConfig(config.id)}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 rounded text-rose-300 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Repos details block */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs">
                        {/* Source info */}
                        <div className="space-y-1.5 border-r border-slate-800/60 pr-2">
                          <div className="flex items-center gap-1 font-bold text-slate-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                            1. Источник (Приватный)
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{config.sourceRepoOwner}/{config.sourceRepoName}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Токен: ****{config.sourceToken.slice(-4) || 'нет'}
                          </p>
                        </div>

                        {/* Dest info */}
                        <div className="space-y-1.5 pl-2">
                          <div className="flex items-center gap-1 font-bold text-slate-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                            2. Приемник (Релизы)
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{config.destRepoOwner}/{config.destRepoName}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <GithubIcon className="h-3 w-3" /> Токен: ****{config.destToken.slice(-4) || 'нет'}
                          </p>
                        </div>
                      </div>

                      {/* Publishing rules */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono flex items-center gap-1">
                          <FileCode className="h-3 w-3 text-indigo-400" />
                          Фильтр: {config.assetFilter?.trim() || 'все файлы'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                          config.updateReadme
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}>
                          <FileText className="h-3 w-3" />
                          README: {config.updateReadme ? 'обновляется' : 'выкл'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        Последний перенос: 
                        <strong className="text-slate-300">
                          {config.lastSyncAt ? formatDate(config.lastSyncAt) : 'Никогда'}
                        </strong>
                      </span>

                      <button
                        onClick={() => {
                          setSelectedConfig(config);
                          setActiveTab('sync');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-0.5"
                      >
                        Открыть релизы <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}


        {/* ----------------- TAB 3: AUDIT HISTORY LOGS ----------------- */}
        {activeTab === 'logs' && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-base font-bold text-slate-100">Журнал синхронизации (Логи)</h2>
                <p className="text-xs text-slate-400">История автоматических и ручных запусков бота на вашем ПК</p>
              </div>

              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-900/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Очистить журнал
                </button>
              )}
            </div>

            {/* Logs List */}
            {isLoadingLogs ? (
              <div className="py-20 text-center">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Загрузка логов из базы данных...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl">
                <History className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Журнал пуст. Запущенные переносы отобразятся здесь.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {logs.map((log) => {
                  let assetsList: Array<{ name: string; size: number }> = [];
                  if (log.syncedAssets) {
                    try {
                      assetsList = JSON.parse(log.syncedAssets);
                    } catch (e) {}
                  }

                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-lg border transition-all text-xs flex flex-col gap-2.5 ${
                        log.status === 'success' 
                          ? 'bg-slate-900/40 border-slate-800/80 hover:border-emerald-500/20' 
                          : 'bg-rose-950/10 border-rose-950/80 hover:border-rose-500/20'
                      }`}
                    >
                      {/* Top status info */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                              <CheckCircle className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="p-1 rounded bg-rose-500/10 text-rose-400">
                              <XCircle className="h-4 w-4" />
                            </span>
                          )}

                          <div>
                            <span className="font-semibold text-slate-200 text-xs">
                              {log.configName}
                            </span>
                            <span className="text-slate-500 text-[10px] ml-2 font-mono">
                              (тег: <strong className="text-indigo-400">{log.tagName}</strong>)
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>

                      {/* Log message */}
                      <p className={`p-2.5 rounded font-mono text-[11px] whitespace-pre-wrap ${
                        log.status === 'success' ? 'bg-slate-950/80 text-slate-300' : 'bg-rose-950/40 text-rose-300'
                      }`}>
                        {log.message}
                      </p>

                      {/* Synced files summary */}
                      {log.status === 'success' && assetsList.length > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 block">Перенесенные файлы ({assetsList.length}):</span>
                          <div className="flex flex-wrap gap-1.5">
                            {assetsList.map((asset, index) => (
                              <span 
                                key={index} 
                                className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono text-slate-300 flex items-center gap-1"
                              >
                                <FileCode className="h-2.5 w-2.5 text-indigo-400" />
                                {asset.name} ({formatBytes(asset.size)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-800/80 py-6 px-6 bg-slate-950/50 text-xs text-center text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>Разработано для локального использования на ПК. Данные сохраняются в локальную базу СУБД Postgres.</p>
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Локальный статус: Активен</span>
          </div>
        </div>
      </footer>


      {/* ----------------- MODAL: CREATE / EDIT CONFIGURATION ----------------- */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl my-8 shadow-2xl relative">
            
            <div className="flex justify-between items-start pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-slate-100 text-base">
                  {editingConfig ? 'Редактировать подключение' : 'Новое подключение репозиториев'}
                </h3>
                <p className="text-xs text-slate-400">Настройте параметры авторизации для обоих GitHub аккаунтов</p>
              </div>
              <button
                onClick={() => { setIsConfigModalOpen(false); setEditingConfig(null); resetForm(); }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
              >
                ✕ Закрыть
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              
              {/* Profile Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Название конфигурации / Ярлык *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Release Pipeline - Stable App"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* SOURCE GITHUB ACCOUNT */}
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-400 pb-1.5 border-b border-slate-800">
                    <Lock className="h-3.5 w-3.5" />
                    <span>1. Аккаунт-Источник (Приватный)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Владелец репозитория (Владелец/Орг) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Например: private-org"
                      value={formSourceOwner}
                      onChange={(e) => setFormSourceOwner(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Имя репозитория *</label>
                    <input
                      type="text"
                      required
                      placeholder="Например: closed-source-app"
                      value={formSourceRepo}
                      onChange={(e) => setFormSourceRepo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 flex items-center justify-between">
                      <span>Personal Access Token (PAT) *</span>
                      <span className="text-[10px] text-slate-500 normal-case">Нужен доступ `repo`</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={formSourceToken}
                      onChange={(e) => setFormSourceToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Inline test button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => testConnection('source')}
                      disabled={testingSource}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      {testingSource ? 'Проверяем...' : 'Проверить доступ к Источнику'}
                    </button>
                    
                    {testSourceResult && (
                      <div className={`mt-2 p-2 rounded text-[11px] font-mono whitespace-pre-wrap border ${
                        testSourceResult.success 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {testSourceResult.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* DESTINATION GITHUB ACCOUNT */}
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-violet-400 pb-1.5 border-b border-slate-800">
                    <GithubIcon className="h-3.5 w-3.5" />
                    <span>2. Аккаунт-Приемник (Только релизы)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Владелец репозитория (Владелец/Орг) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Например: public-releases-org"
                      value={formDestOwner}
                      onChange={(e) => setFormDestOwner(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Имя репозитория *</label>
                    <input
                      type="text"
                      required
                      placeholder="Например: app-binaries"
                      value={formDestRepo}
                      onChange={(e) => setFormDestRepo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 flex items-center justify-between">
                      <span>Personal Access Token (PAT) *</span>
                      <span className="text-[10px] text-slate-500 normal-case">Нужен доступ `repo`</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={formDestToken}
                      onChange={(e) => setFormDestToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Inline test button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => testConnection('dest')}
                      disabled={testingDest}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      {testingDest ? 'Проверяем...' : 'Проверить доступ к Приемнику'}
                    </button>

                    {testDestResult && (
                      <div className={`mt-2 p-2 rounded text-[11px] font-mono whitespace-pre-wrap border ${
                        testDestResult.success 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {testDestResult.message}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Release publishing options */}
              <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 pb-1.5 border-b border-slate-800">
                  <FileCode className="h-3.5 w-3.5" />
                  <span>Правила публикации релиза</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 flex items-center justify-between">
                    <span>Фильтр файлов (расширения через запятую)</span>
                    <span className="text-[10px] text-slate-500 normal-case">Оставьте пустым для всех файлов</span>
                  </label>
                  <input
                    type="text"
                    placeholder=".exe"
                    value={formAssetFilter}
                    onChange={(e) => setFormAssetFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {['.exe', '.exe,.msi', '.exe,.msi,.zip', '.dmg,.pkg'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormAssetFilter(preset)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-mono border border-slate-700 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    В релиз-приемник будут загружены только файлы с указанными расширениями. По умолчанию — только установщики <code className="text-indigo-400">.exe</code>.
                  </p>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="formUpdateReadme"
                    checked={formUpdateReadme}
                    onChange={(e) => setFormUpdateReadme(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="formUpdateReadme" className="text-slate-300 cursor-pointer select-none text-[11px] leading-snug">
                    <strong className="text-slate-200">Обновлять README.md</strong> в репозитории-приемнике на основе changelog релиза (список файлов, версия и описание изменений).
                  </label>
                </div>

                <div className="text-[10px] text-slate-500 bg-indigo-500/5 border border-indigo-500/10 rounded p-2">
                  ℹ️ Тег и нумерация версии всегда совпадают с исходным репозиторием (переносятся как есть).
                </div>
              </div>

              {/* Status active */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="formActive" className="text-slate-300 font-semibold cursor-pointer select-none">
                  Активировать этот конвейер в панели
                </label>
              </div>

              {/* Footer actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setIsConfigModalOpen(false); setEditingConfig(null); resetForm(); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold transition-all shadow-md shadow-indigo-600/10"
                >
                  {editingConfig ? 'Сохранить изменения' : 'Создать подключение'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
