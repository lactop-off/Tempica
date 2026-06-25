import {
  IconHome,
  IconClock,
  IconCalendar,
  IconDoc,
  IconCheck,
  IconGrid,
  IconLeaf,
  IconUsers,
  IconSliders,
  IconShield,
  IconUpload,
  IconRoute,
  IconClipboard,
  IconBuilding,
  IconCog,
} from '@/components/icons';
import type { SVGProps } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: (p: SVGProps<SVGSVGElement>) => JSX.Element;
  /** 表示に必要な権限（feature, action）。未指定なら常時表示。 */
  perm?: [string, string];
  /** 承認待ちバッジ等のキー */
  badge?: 'approvals';
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'メニュー',
    items: [
      { href: '/dashboard', label: 'ダッシュボード', icon: IconHome },
      { href: '/punch', label: '打刻', icon: IconClock, perm: ['attendance', 'create'] },
      { href: '/attendance', label: '自分の勤怠', icon: IconCalendar, perm: ['attendance', 'view'] },
      { href: '/requests', label: '申請', icon: IconDoc, perm: ['request', 'view'] },
      { href: '/approvals', label: '承認', icon: IconCheck, perm: ['approval', 'approve'], badge: 'approvals' },
      { href: '/shift', label: 'シフト', icon: IconGrid, perm: ['shift', 'view'] },
      { href: '/leave', label: '休暇', icon: IconLeaf, perm: ['leave', 'view'] },
    ],
  },
  {
    title: '管理',
    items: [
      { href: '/members', label: 'メンバー', icon: IconUsers, perm: ['member', 'view'] },
      { href: '/departments', label: '部署', icon: IconBuilding, perm: ['department', 'view'] },
      { href: '/work-patterns', label: '勤務形態', icon: IconSliders, perm: ['work_pattern', 'view'] },
      { href: '/roles', label: 'ロール・権限', icon: IconShield, perm: ['role', 'view'] },
      { href: '/approval-routes', label: '承認経路', icon: IconRoute, perm: ['organization', 'manage'] },
      { href: '/closing', label: '月次締め・CSV', icon: IconUpload, perm: ['closing', 'manage'] },
      { href: '/organization', label: '組織設定', icon: IconCog, perm: ['organization', 'manage'] },
      { href: '/audit', label: '監査ログ', icon: IconClipboard, perm: ['audit', 'view'] },
    ],
  },
];

// モバイルのボトムナビ（5項目）
export const BOTTOM_NAV: NavItem[] = [
  { href: '/dashboard', label: 'ホーム', icon: IconHome },
  { href: '/punch', label: '打刻', icon: IconClock, perm: ['attendance', 'create'] },
  { href: '/requests', label: '申請', icon: IconDoc, perm: ['request', 'view'] },
  { href: '/approvals', label: '承認', icon: IconCheck, perm: ['approval', 'approve'], badge: 'approvals' },
  { href: '/attendance', label: '勤怠', icon: IconCalendar, perm: ['attendance', 'view'] },
];
