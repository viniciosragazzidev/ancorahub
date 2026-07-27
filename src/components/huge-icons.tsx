import type { ComponentProps } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import * as HugeIcons from "@hugeicons/core-free-icons";

type HugeIconProps = ComponentProps<typeof HugeiconsIcon>;
type CompatIconProps = Omit<HugeIconProps, "icon"> & { weight?: string };

const aliases: Record<string, string> = {
  ArrowDownRight: "ArrowDownRight01Icon",
  ArrowLeft: "ArrowLeft01Icon",
  ArrowRight: "ArrowRight01Icon",
  ArrowsDownUp: "ArrowUpDownIcon",
  ArrowUpRight: "ArrowUpRight01Icon",
  Bell: "Notification01Icon",
  BellRinging: "Notification02Icon",
  BookOpen: "Book02Icon",
  Buildings: "Building06Icon",
  Calculator: "CalculatorIcon",
  CalendarBlank: "Calendar01Icon",
  CalendarCheck: "CalendarCheckIcon",
  ChartBar: "BarChartIcon",
  ChartLineUp: "ChartLineData01Icon",
  ChatCircleText: "Message01Icon",
  CheckCircle: "CheckmarkCircle02Icon",
  CheckIcon: "Tick01Icon",
  ChevronDownIcon: "ArrowDown01Icon",
  ChevronRightIcon: "ArrowRight01Icon",
  ChevronUpIcon: "ArrowUp01Icon",
  Circle: "CircleIcon",
  CircleDashed: "Loading03Icon",
  ClipboardText: "ClipboardIcon",
  Clock: "Clock01Icon",
  Compass: "CompassIcon",
  Copy: "Copy01Icon",
  CreditCard: "CreditCardIcon",
  CurrencyCircleDollar: "CircleDollarSignIcon",
  Database: "DatabaseIcon",
  DotsThreeVertical: "MoreVerticalIcon",
  Eye: "ViewIcon",
  EyeSlash: "ViewOffIcon",
  FileArrowDown: "FileDownloadIcon",
  FileText: "File02Icon",
  Fingerprint: "Fingerprint01Icon",
  Flag: "Flag02Icon",
  FolderSimple: "Folder01Icon",
  Gear: "Settings01Icon",
  Globe: "Globe02Icon",
  Handshake: "HandshakeIcon",
  House: "Home01Icon",
  InfoIcon: "InformationCircleIcon",
  Key: "Key01Icon",
  Lightning: "ZapIcon",
  LinkSimple: "Link01Icon",
  ArrowSquareOut: "LinkSquare01Icon",
  ListChecks: "Task01Icon",
  Loader2Icon: "Loading03Icon",
  LockKey: "LockKeyIcon",
  MagnifyingGlass: "Search01Icon",
  Monitor: "ComputerIcon",
  MoonStars: "Moon02Icon",
  MoreHorizontalIcon: "MoreHorizontalIcon",
  Note: "Note01Icon",
  OctagonXIcon: "CancelCircleIcon",
  PaperPlaneTilt: "SentIcon",
  Pause: "PauseIcon",
  PencilSimple: "PencilEdit01Icon",
  Phone: "Call02Icon",
  PiggyBank: "MoneySavingJarIcon",
  Plug: "Plug01Icon",
  Plus: "PlusSignIcon",
  PanelLeftIcon: "SidebarLeftIcon",
  Power: "PowerIcon",
  Quotes: "QuoteDownIcon",
  RoadHorizon: "RoadIcon",
  RocketLaunch: "Rocket01Icon",
  SealCheck: "CheckmarkBadge01Icon",
  ShieldCheck: "Shield01Icon",
  ShieldStar: "SecurityCheckIcon",
  ShieldWarning: "ShieldQuestionMarkIcon",
  SignOut: "Logout01Icon",
  SlidersHorizontal: "SlidersHorizontalIcon",
  SquaresFour: "DashboardSquare01Icon",
  SunDim: "Sun03Icon",
  Target: "Target01Icon",
  Trash: "Delete02Icon",
  TrendDown: "AnalyticsDownIcon",
  TrendUp: "AnalyticsUpIcon",
  TriangleAlertIcon: "Alert02Icon",
  UserList: "UserListIcon",
  UserPlus: "UserAdd01Icon",
  Users: "UserGroupIcon",
  UsersThree: "UserGroupIcon",
  UserSwitch: "UserSwitchIcon",
  Warning: "Alert02Icon",
  WarningCircle: "AlertCircleIcon",
  WhatsappLogo: "WhatsappIcon",
  WifiHigh: "Wifi01Icon",
  X: "Cancel01Icon",
  XCircle: "CancelCircleIcon",
  XIcon: "Cancel01Icon",
  CircleCheckIcon: "CheckmarkCircle02Icon",
  ArrowsClockwise: "RefreshIcon",
  HelpCircle: "HelpCircleIcon",
  Megaphone: "MegaphoneIcon",
  ShareAll: "ShareAllIcon",
};

function resolveIcon(name: string): HugeIconProps["icon"] {
  const iconName = aliases[name] ?? name;
  const icon = (HugeIcons as Record<string, unknown>)[iconName];
  const fallback = (HugeIcons as Record<string, unknown>).CircleIcon;
  return (icon ?? fallback) as HugeIconProps["icon"];
}

function createCompatIcon(name: string) {
  function CompatIcon({ weight, ...props }: CompatIconProps) {
    void weight;
    return <HugeiconsIcon icon={resolveIcon(name)} {...props} />;
  }

  CompatIcon.displayName = `${name}HugeIcon`;
  return CompatIcon;
}

export const ArrowDownRight = createCompatIcon("ArrowDownRight");
export const ArrowSquareOut = createCompatIcon("ArrowSquareOut");
export const ArrowLeft = createCompatIcon("ArrowLeft");
export const ArrowRight = createCompatIcon("ArrowRight");
export const ArrowsDownUp = createCompatIcon("ArrowsDownUp");
export const ArrowUpRight = createCompatIcon("ArrowUpRight");
export const Bell = createCompatIcon("Bell");
export const BellRinging = createCompatIcon("BellRinging");
export const BookOpen = createCompatIcon("BookOpen");
export const Buildings = createCompatIcon("Buildings");
export const Calculator = createCompatIcon("Calculator");
export const CalendarBlank = createCompatIcon("CalendarBlank");
export const CalendarCheck = createCompatIcon("CalendarCheck");
export const ChartBar = createCompatIcon("ChartBar");
export const ChartLineUp = createCompatIcon("ChartLineUp");
export const ChatCircleText = createCompatIcon("ChatCircleText");
export const Check = createCompatIcon("CheckIcon");
export const CheckCircle = createCompatIcon("CheckCircle");
export const CheckIcon = createCompatIcon("CheckIcon");
export const ChevronDownIcon = createCompatIcon("ChevronDownIcon");
export const ChevronRightIcon = createCompatIcon("ChevronRightIcon");
export const ChevronUpIcon = createCompatIcon("ChevronUpIcon");
export const Circle = createCompatIcon("Circle");
export const CircleCheckIcon = createCompatIcon("CircleCheckIcon");
export const CircleDashed = createCompatIcon("CircleDashed");
export const ClipboardText = createCompatIcon("ClipboardText");
export const Clock = createCompatIcon("Clock");
export const Compass = createCompatIcon("Compass");
export const Copy = createCompatIcon("Copy");
export const CreditCard = createCompatIcon("CreditCard");
export const CurrencyCircleDollar = createCompatIcon("CurrencyCircleDollar");
export const Database = createCompatIcon("Database");
export const DotsThreeVertical = createCompatIcon("DotsThreeVertical");
export const Eye = createCompatIcon("Eye");
export const EyeSlash = createCompatIcon("EyeSlash");
export const FileArrowDown = createCompatIcon("FileArrowDown");
export const FileText = createCompatIcon("FileText");
export const Fingerprint = createCompatIcon("Fingerprint");
export const Flag = createCompatIcon("Flag");
export const FolderSimple = createCompatIcon("FolderSimple");
export const Gear = createCompatIcon("Gear");
export const Globe = createCompatIcon("Globe");
export const Handshake = createCompatIcon("Handshake");
export const House = createCompatIcon("House");
export const InfoIcon = createCompatIcon("InfoIcon");
export const HelpCircle = createCompatIcon("HelpCircle");
export const Key = createCompatIcon("Key");
export const Lightning = createCompatIcon("Lightning");
export const LinkSimple = createCompatIcon("LinkSimple");
export const ListChecks = createCompatIcon("ListChecks");
export const Loader2Icon = createCompatIcon("Loader2Icon");
export const LockKey = createCompatIcon("LockKey");
export const MagnifyingGlass = createCompatIcon("MagnifyingGlass");
export const MagicWand = createCompatIcon("MagicWand");
export const Monitor = createCompatIcon("Monitor");
export const MoonStars = createCompatIcon("MoonStars");
export const MoreHorizontalIcon = createCompatIcon("MoreHorizontalIcon");
export const Note = createCompatIcon("Note");
export const OctagonXIcon = createCompatIcon("OctagonXIcon");
export const PaperPlaneTilt = createCompatIcon("PaperPlaneTilt");
export const Pause = createCompatIcon("Pause");
export const PencilSimple = createCompatIcon("PencilSimple");
export const Phone = createCompatIcon("Phone");
export const PiggyBank = createCompatIcon("PiggyBank");
export const Plug = createCompatIcon("Plug");
export const Plus = createCompatIcon("Plus");
export const PanelLeftIcon = createCompatIcon("PanelLeftIcon");
export const Power = createCompatIcon("Power");
export const Quotes = createCompatIcon("Quotes");
export const RoadHorizon = createCompatIcon("RoadHorizon");
export const RocketLaunch = createCompatIcon("RocketLaunch");
export const Share = createCompatIcon("Share");
export const SealCheck = createCompatIcon("SealCheck");
export const ShieldCheck = createCompatIcon("ShieldCheck");
export const ShieldStar = createCompatIcon("ShieldStar");
export const ShieldWarning = createCompatIcon("ShieldWarning");
export const SignOut = createCompatIcon("SignOut");
export const SlidersHorizontal = createCompatIcon("SlidersHorizontal");
export const SquaresFour = createCompatIcon("SquaresFour");
export const SunDim = createCompatIcon("SunDim");
export const Target = createCompatIcon("Target");
export const Trash = createCompatIcon("Trash");
export const TrendDown = createCompatIcon("TrendDown");
export const TrendUp = createCompatIcon("TrendUp");
export const TriangleAlertIcon = createCompatIcon("TriangleAlertIcon");
export const UserList = createCompatIcon("UserList");
export const UserPlus = createCompatIcon("UserPlus");
export const Users = createCompatIcon("Users");
export const UsersThree = createCompatIcon("UsersThree");
export const UserSwitch = createCompatIcon("UserSwitch");
export const Warning = createCompatIcon("Warning");
export const WarningCircle = createCompatIcon("WarningCircle");
export const WhatsappLogo = createCompatIcon("WhatsappLogo");
export const WifiHigh = createCompatIcon("WifiHigh");
export const X = createCompatIcon("X");
export const XCircle = createCompatIcon("XCircle");
export const XIcon = createCompatIcon("XIcon");
export const ArrowsClockwise = createCompatIcon("ArrowsClockwise");
export const Megaphone = createCompatIcon("Megaphone");
export const ShareAll = createCompatIcon("ShareAll");
