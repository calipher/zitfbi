import React, { useMemo, useState } from 'react';
import { useBI } from '../../context/BIContext';
import { canAccessNavTab } from '../../utils/rbac';
import {
  LayoutDashboard,
  Store,
  Users,
  Coins,
  Handshake,
  Activity,
  TrendingUp,
  FileBarChart,
  Database,
  UserCog,
  Settings,
  Sparkles,
  Lock,
  X,
  Cpu,
  Share2,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed?: boolean;
}

interface NavItemConfig {
  id: string;
  label: string;
  subLabel: string;
  icon: React.ElementType;
  badgeCount?: number;
}

interface NavSectionConfig {
  id: string;
  group: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed = false,
}) => {
  const { currentUser, setIsAIAssistantOpen, selectedEditionId, editions, sharedItems, annotations } = useBI();

  const [sidebarQuery, setSidebarQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    executive: true,
    pillars: true,
    admin: true,
  });

  const currentEditionObj = editions.find((e) => e.id === selectedEditionId);
  const pendingCollabCount =
    sharedItems.filter((s) => s.workflowStatus === 'In Review' || s.workflowStatus === 'Changes Requested').length +
    annotations.filter((a) => a.status === 'Open').length;

  const navSections: NavSectionConfig[] = useMemo(
    () => [
      {
        id: 'executive',
        group: 'Consolidated Executive',
        items: [
          {
            id: 'overview',
            label: 'Executive Dashboard',
            subLabel: 'Holistic 6-Pillar Overview',
            icon: LayoutDashboard,
          },
          {
            id: 'mining',
            label: 'Data Mining & Forecast',
            subLabel: 'Regression & Clustering',
            icon: Cpu,
          },
        ],
      },
      {
        id: 'pillars',
        group: 'Six Strategic Pillars',
        items: [
          {
            id: 'exhibitors',
            label: 'Exhibitor Intelligence',
            subLabel: 'Participation & Retention',
            icon: Store,
          },
          {
            id: 'visitors',
            label: 'Visitor Intelligence',
            subLabel: 'Attendance & Segmentation',
            icon: Users,
          },
          {
            id: 'commercial',
            label: 'Commercial Intelligence',
            subLabel: 'Revenue, Bookings & Sales',
            icon: Coins,
          },
          {
            id: 'trade',
            label: 'Trade Impact',
            subLabel: 'B2B Deals & Facilitation',
            icon: Handshake,
          },
          {
            id: 'operations',
            label: 'Operational Intelligence',
            subLabel: 'Venues, ICT & Incidents',
            icon: Activity,
          },
          {
            id: 'market',
            label: 'Strategic Market Insight',
            subLabel: 'Sector Trends & Horizons',
            icon: TrendingUp,
          },
        ],
      },
      {
        id: 'admin',
        group: 'Reporting & Admin',
        items: [
          {
            id: 'reports',
            label: 'Reports & Alerts',
            subLabel: 'Generate & Export BI Briefs',
            icon: FileBarChart,
          },
          {
            id: 'collaborate',
            label: 'Share & Collaborate',
            subLabel:
              pendingCollabCount > 0
                ? `${pendingCollabCount} Active Reviews`
                : 'Share, Email & Approvals',
            icon: Share2,
            badgeCount: pendingCollabCount > 0 ? pendingCollabCount : undefined,
          },
          {
            id: 'data',
            label: 'Data Management',
            subLabel: 'Import, Mapping & Quality',
            icon: Database,
          },
          {
            id: 'users',
            label: 'User Management',
            subLabel: 'Roles & Access Control',
            icon: UserCog,
          },
          {
            id: 'settings',
            label: 'System Settings',
            subLabel: 'Firebase, Editions & SLA',
            icon: Settings,
          },
        ],
      },
    ],
    [pendingCollabCount]
  );

  const normalizedQuery = sidebarQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return navSections;
    return navSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.subLabel.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [navSections, normalizedQuery]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* AdminLTE v4 Dark Sidebar (#343a40) */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 bg-[#343a40] text-[#c2c7d0] border-r border-[#2c3136] flex flex-col z-50 transition-all duration-200 ease-in-out shrink-0 no-print ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}`}
      >
        {/* AdminLTE Brand Link Bar (h-14 matches top navbar height) */}
        <div className="h-14 px-3.5 border-b border-[#4b545c] bg-[#2c3136] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectTab('overview');
              setIsMobileOpen(false);
            }}
            className={`flex items-center gap-2.5 min-w-0 cursor-pointer ${
              isCollapsed ? 'lg:mx-auto' : ''
            }`}
            title="ZITF Business Intelligence Home"
          >
            <div className="h-8 w-8 bg-white rounded flex items-center justify-center shrink-0 p-1 shadow-xs">
              <img
                src="/assets/aistudio/zitf_3bc77275.png"
                alt="ZITF Logo"
                className="h-5 w-auto object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="text-left truncate">
                <div className="text-sm font-bold text-white tracking-tight leading-tight truncate">
                  ZITF <span className="font-light text-slate-300">BI Admin</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 leading-none">
                  LTE v4 · SQLite Hub
                </div>
              </div>
            )}
          </button>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AdminLTE Sidebar User Panel */}
        {!isCollapsed ? (
          <div className="px-3.5 py-3 border-b border-[#4b545c] flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#0d6efd] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-[10px] text-slate-300 truncate font-mono">{currentUser.role}</div>
            </div>
          </div>
        ) : (
          <div
            className="hidden lg:flex py-3 border-b border-[#4b545c] justify-center shrink-0"
            title={`${currentUser.name} (${currentUser.role})`}
          >
            <div className="w-8 h-8 rounded-full bg-[#0d6efd] text-white font-bold text-xs flex items-center justify-center">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* AdminLTE Sidebar Search Form */}
        {!isCollapsed && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                placeholder="Search menu..."
                aria-label="Search navigation menu"
                className="w-full bg-[#3f474e] text-xs text-white placeholder:text-slate-400 border border-[#56606a] rounded px-2.5 py-1.5 pr-7 focus:outline-none focus:border-sky-400"
              />
              {sidebarQuery ? (
                <button
                  type="button"
                  onClick={() => setSidebarQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Clear menu search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
          </div>
        )}

        {/* Active Edition Indicator Strip (compact unboxed metadata) */}
        {!isCollapsed && (
          <div className="px-3.5 py-2 border-b border-[#4b545c]/70 flex items-center justify-between text-[11px] shrink-0">
            <span className="text-slate-300 font-medium truncate">
              {currentEditionObj ? currentEditionObj.name : 'All Editions'}
            </span>
            <span className="font-mono text-[10px] text-amber-300 shrink-0 ml-2">
              {currentEditionObj ? currentEditionObj.year : 'HIST'}
            </span>
          </div>
        )}

        {/* AdminLTE Treeview Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-2 text-xs">
          {filteredSections.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-slate-400">
              No navigation modules match &quot;{sidebarQuery}&quot;.
            </div>
          ) : (
            filteredSections.map((sec) => {
              const isGroupOpen = normalizedQuery ? true : openGroups[sec.id] ?? true;

              return (
                <div key={sec.id} className="space-y-0.5">
                  {/* Treeview Section Header */}
                  {!isCollapsed ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(sec.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <span className="truncate">{sec.group}</span>
                      {isGroupOpen ? (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <div className="hidden lg:block border-t border-[#4b545c]/60 my-1.5 mx-2" />
                  )}

                  {/* Section Items */}
                  {(isGroupOpen || isCollapsed) && (
                    <div className="space-y-0.5">
                      {sec.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        const isRestricted = !canAccessNavTab(currentUser.role, item.id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={isRestricted}
                            title={isCollapsed ? `${item.label} — ${item.subLabel}` : undefined}
                            onClick={() => {
                              if (!isRestricted) {
                                onSelectTab(item.id);
                                setIsMobileOpen(false);
                              }
                            }}
                            className={`w-full flex items-center ${
                              isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-2.5'
                            } py-2 rounded text-left transition-colors ${
                              isRestricted
                                ? 'opacity-45 cursor-not-allowed text-slate-400'
                                : isActive
                                ? 'bg-[#0d6efd] text-white font-semibold shadow-2xs cursor-pointer'
                                : 'text-[#c2c7d0] hover:bg-white/10 hover:text-white cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  isActive ? 'text-white' : 'text-[#c2c7d0]'
                                }`}
                              />
                              {!isCollapsed && (
                                <span className="truncate leading-tight text-xs">{item.label}</span>
                              )}
                            </div>

                            {!isCollapsed && (
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {item.badgeCount !== undefined && !isRestricted && (
                                  <span
                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded tabular-nums ${
                                      isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-amber-500 text-slate-950'
                                    }`}
                                  >
                                    {item.badgeCount}
                                  </span>
                                )}
                                {isRestricted && (
                                  <span title="Restricted by role permission">
                                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* Bottom Sidebar AI Trigger */}
        <div className="p-2.5 border-t border-[#4b545c] bg-[#2c3136] shrink-0">
          <button
            type="button"
            onClick={() => setIsAIAssistantOpen(true)}
            title="Ask ZITF Intelligence AI"
            className={`w-full flex items-center justify-center gap-2 px-2.5 py-2 bg-[#3f474e] hover:bg-[#49525a] text-amber-300 border border-[#56606a] rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {!isCollapsed && <span>Ask ZITF AI</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
