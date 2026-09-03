import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Tag,
  CreditCard,
  BarChart3,
  Settings,
  X,
  LogOut,
  Trophy,
  ChevronLeft,
  ChevronRight,
  History,
  UserCog,
  LogIn,
  UserPlus,
  Receipt,
  Plus,
  ShieldCheck,
  Bell,
  Sliders,
  Building2,
  IdCard,
  Server,
  Shield,
  Key,
  Download,
  Snowflake,
  Trash,
  Eraser,
  RotateCcw,
  FileText,
  Check,
  AlertTriangle,
  Layers,
  Menu as MenuIcon,
  Gauge,
  MessageSquare,
  Phone,
  Mail,
  Send,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Clock,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  MinusCircle,
  Edit,
  Save,
  XCircle,
  CheckCircle,
  AlertCircle,
  Info,
  Loader,
  Copy,
  Trash2,
  ExternalLink,
} from 'lucide-react';

/**
 * Resolve a Lucide icon name string to its React component.
 * Returns null if the name is unknown or empty.
 */
export function resolveIcon(
  iconName?: string,
): React.ComponentType<{ className?: string }> | null {
  if (!iconName) return null;

  switch (iconName) {
    // Navigation & layout
    case 'LayoutDashboard': return LayoutDashboard;
    case 'Menu': return MenuIcon;
    case 'Gauge': return Gauge;
    case 'Layers': return Layers;

    // Members & people
    case 'Users': return Users;
    case 'UserCog': return UserCog;
    case 'UserPlus': return UserPlus;
    case 'LogIn': return LogIn;
    case 'LogOut': return LogOut;
    case 'UserCheck': return UserCog; // closest match
    case 'IdCard': return IdCard;

    // Attendance
    case 'CalendarCheck': return CalendarCheck;
    case 'Check': return Check;
    case 'X': return X;

    // Payments & financial
    case 'CreditCard': return CreditCard;
    case 'Receipt': return Receipt;
    case 'DollarSign': return DollarSign;
    case 'Tag': return Tag;
    case 'Trophy': return Trophy;

    // Plans
    case 'FileText': return FileText;
    case 'Plus': return Plus;

    // Staff & roles
    case 'ShieldCheck': return ShieldCheck;
    case 'Shield': return Shield;

    // Reports
    case 'BarChart3': return BarChart3;
    case 'TrendingUp': return TrendingUp;
    case 'Download': return Download;

    // Settings
    case 'Settings': return Settings;
    case 'Bell': return Bell;
    case 'Sliders': return Sliders;
    case 'Building2': return Building2;
    case 'Key': return Key;
    case 'History': return History;

    // Member actions
    case 'Snowflake': return Snowflake;
    case 'RotateCcw': return RotateCcw;
    case 'Trash': return Trash;
    case 'Eraser': return Eraser;

    // Admin / platform
    case 'Server': return Server;

    // Communication
    case 'MessageSquare': return MessageSquare;
    case 'Phone': return Phone;
    case 'Mail': return Mail;
    case 'Send': return Send;

    // Navigation
    case 'ArrowLeft': return ArrowLeft;
    case 'ArrowRight': return ArrowRight;
    case 'ChevronLeft': return ChevronLeft;
    case 'ChevronRight': return ChevronRight;
    case 'ChevronDown': return ChevronDown;
    case 'ChevronUp': return ChevronUp;

    // Common actions
    case 'RefreshCw': return RefreshCw;
    case 'Search': return Search;
    case 'Filter': return Filter;
    case 'MoreHorizontal': return MoreHorizontal;
    case 'Eye': return Eye;
    case 'EyeOff': return EyeOff;
    case 'Edit': return Edit;
    case 'Save': return Save;
    case 'Copy': return Copy;
    case 'ExternalLink': return ExternalLink;
    case 'PlusCircle': return PlusCircle;
    case 'MinusCircle': return MinusCircle;

    // Status
    case 'CheckCircle': return CheckCircle;
    case 'XCircle': return XCircle;
    case 'AlertCircle': return AlertCircle;
    case 'Info': return Info;
    case 'AlertTriangle': return AlertTriangle;
    case 'Loader': return Loader;

    default:
      return null;
  }
}
