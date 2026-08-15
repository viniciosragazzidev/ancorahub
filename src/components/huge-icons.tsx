'use client';

import { type ComponentProps, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import * as HugeIcons from "@hugeicons/core-free-icons";

// ── Animated icon components ─────────────────────────────────────────
import { HugeiconsArrowLeftIcon } from "./ui/animated-icons/hugeicons/arrow-left";
import { HugeiconsArrowUpRightIcon } from "./ui/animated-icons/hugeicons/arrow-up-right";
import { HugeiconsArrowRightIcon } from "./ui/animated-icons/hugeicons/arrow-right";
import { HugeiconsBellIcon } from "./ui/animated-icons/hugeicons/bell";
import { HugeiconsCalendarIcon } from "./ui/animated-icons/hugeicons/calendar";
import { HugeiconsCheckIcon } from "./ui/animated-icons/hugeicons/check";
import { HugeiconsChevronDownIcon } from "./ui/animated-icons/hugeicons/chevron-down";
import { HugeiconsChevronRightIcon } from "./ui/animated-icons/hugeicons/chevron-right";
import { HugeiconsChevronUpIcon } from "./ui/animated-icons/hugeicons/chevron-up";
import { HugeiconsDownloadIcon } from "./ui/animated-icons/hugeicons/download";
import { HugeiconsEyeIcon } from "./ui/animated-icons/hugeicons/eye";
import { HugeiconsFilterIcon } from "./ui/animated-icons/hugeicons/filter";
import { HugeiconsHomeIcon } from "./ui/animated-icons/hugeicons/home";
import { HugeiconsLockIcon } from "./ui/animated-icons/hugeicons/lock";
import { HugeiconsMailIcon } from "./ui/animated-icons/hugeicons/mail";
import { HugeiconsMenuIcon } from "./ui/animated-icons/hugeicons/menu";
import { HugeiconsNotification03Icon } from "./ui/animated-icons/hugeicons/notification-03";
import { HugeiconsPencilIcon } from "./ui/animated-icons/hugeicons/pencil";
import { HugeiconsPlusIcon } from "./ui/animated-icons/hugeicons/plus";
import { HugeiconsRefreshIcon } from "./ui/animated-icons/hugeicons/refresh";
import { HugeiconsSaveIcon } from "./ui/animated-icons/hugeicons/save";
import { HugeiconsSearchIcon } from "./ui/animated-icons/hugeicons/search";
import { HugeiconsSettingsIcon } from "./ui/animated-icons/hugeicons/settings";
import { HugeiconsShareIcon } from "./ui/animated-icons/hugeicons/share";
import { HugeiconsTrashIcon } from "./ui/animated-icons/hugeicons/trash";
import { HugeiconsUserIcon } from "./ui/animated-icons/hugeicons/user";
import { HugeiconsXIcon } from "./ui/animated-icons/hugeicons/x";
import { HugeiconsXCircleIcon } from "./ui/animated-icons/hugeicons/x-circle";
import { HugeiconsShieldCheckIcon } from "./ui/animated-icons/hugeicons/shield-check";

// ── Types ─────────────────────────────────────────────────────────────
type HugeIconProps = ComponentProps<typeof HugeiconsIcon>;
type CompatIconProps = Omit<HugeIconProps, "icon"> & { weight?: string };

interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

type AnimatedIconComponent = React.ForwardRefExoticComponent<
  {
    size?: number;
    className?: string;
  } & React.RefAttributes<AnimatedIconHandle>
>;

// ── Icon aliases ──────────────────────────────────────────────────────
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
  Sparkle: "SparklesIcon",
  SunDim: "Sun03Icon",
  Target: "Target01Icon",
  Trash: "Delete02Icon",
  TrendDown: "AnalyticsDownIcon",
  TrendUp: "AnalyticsUpIcon",
  TriangleAlertIcon: "Alert02Icon",
  UserList: "UserListIcon",
  UserPlus: "UserAdd01Icon",
  UserCircle: "UserCircleIcon",
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
  Redistribute: "ArrowDataTransferHorizontalIcon",
  HelpCircle: "HelpCircleIcon",
  Megaphone: "MegaphoneIcon",
  ShareAll: "ShareAllIcon",
  ArrowsOut: "Expand01Icon",
  ArrowsIn: "Shrink01Icon",
  RotateCcw: "RefreshIcon",
  UserCheck: "UserCheckIcon",
  Flame: "FireIcon",
  ThermometerCold: "SnowflakeIcon",
  ShieldX: "SecurityValidationIcon",
};

function resolveIcon(name: string): HugeIconProps["icon"] {
  const iconName = aliases[name] ?? name;
  const icon = (HugeIcons as Record<string, unknown>)[iconName];
  const fallback = (HugeIcons as Record<string, unknown>).CircleIcon;
  return (icon ?? fallback) as HugeIconProps["icon"];
}

// ── Wrappers ───────────────────────────────────────────────────────────

/**
 * Wrap an animated icon component. The animation triggers on hover of
 * the **parent element** (not only the icon itself).
 */
function animated(
  name: string,
  Component: AnimatedIconComponent,
) {
  const AnimatedWrapper = ({ weight, ...props }: CompatIconProps) => {
    const iconRef = useRef<AnimatedIconHandle>(null);
    const wrapperRef = useRef<HTMLSpanElement>(null);

    void weight;

    useEffect(() => {
      // Listen for hover on the parent element (button, list item, etc.)
      const parent = wrapperRef.current?.parentElement;
      if (!parent) return;

      const handleEnter = () => iconRef.current?.startAnimation();
      const handleLeave = () => iconRef.current?.stopAnimation();

      parent.addEventListener("mouseenter", handleEnter);
      parent.addEventListener("mouseleave", handleLeave);

      return () => {
        parent.removeEventListener("mouseenter", handleEnter);
        parent.removeEventListener("mouseleave", handleLeave);
      };
    }, []);

    const rawClassName = (props as Record<string, unknown>).className as string | undefined;
    const rawSize = (props as Record<string, unknown>).size as number | undefined;

    return (
      <span
        ref={wrapperRef}
        className={cn(
          // The outer span is the sized, positioned flex container. It holds
          // the icon centered so baseline quirks from the inner element can't
          // push it higher/lower than the content it accompanies.
          "inline-flex shrink-0 items-center justify-center",
          rawClassName,
        )}
      >
        <Component
          ref={iconRef}
          className={cn(
            "inline-flex size-full items-center justify-center",
            // Force SVG children to fill their CSS-sized container
            "[&_svg]:size-full",
          )}
          size={rawSize ?? 24}
        />
      </span>
    );
  };
  AnimatedWrapper.displayName = `${name}HugeIcon`;
  return AnimatedWrapper;
}

/**
 * Wrap a static HugeiconsIcon with a subtle hover-scale effect.
 * The animation triggers on hover of the **parent element**.
 */
function staticAnimated(name: string) {
  function StaticMotionIcon({ weight, ...props }: CompatIconProps) {
    const spanRef = useRef<HTMLSpanElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    void weight;

    useEffect(() => {
      // Listen for hover on the parent element
      const parent = spanRef.current?.parentElement;
      if (!parent) return;

      const handleEnter = () => setIsHovered(true);
      const handleLeave = () => setIsHovered(false);

      parent.addEventListener("mouseenter", handleEnter);
      parent.addEventListener("mouseleave", handleLeave);

      return () => {
        parent.removeEventListener("mouseenter", handleEnter);
        parent.removeEventListener("mouseleave", handleLeave);
      };
    }, []);

    return (
      <motion.span
        ref={spanRef}
        className={cn(
          // Same contract as `animated`: the outer span is the sized, positioned
          // flex container so the icon stays centered next to any content.
          "inline-flex shrink-0 items-center justify-center",
          (props as Record<string, unknown>).className as string | undefined,
        )}
        animate={{ scale: isHovered ? 1.1 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <HugeiconsIcon
          icon={resolveIcon(name)}
          size={(props as Record<string, unknown>).size as number | undefined ?? 24}
          {...(props as Record<string, unknown>)}
          className="size-full"
        />
      </motion.span>
    );
  }
  StaticMotionIcon.displayName = `${name}HugeIcon`;
  return StaticMotionIcon;
}

// ── Animated icon exports ─────────────────────────────────────────────
// These icons have custom hover animations (bell ringing, search draw, etc.)
export const ArrowLeft = animated("ArrowLeft", HugeiconsArrowLeftIcon);
export const ArrowRight = animated("ArrowRight", HugeiconsArrowRightIcon);
export const Bell = animated("Bell", HugeiconsBellIcon);
export const BellRinging = animated("BellRinging", HugeiconsBellIcon);
export const CalendarBlank = animated("CalendarBlank", HugeiconsCalendarIcon);
export const CalendarCheck = animated("CalendarCheck", HugeiconsCalendarIcon);
export const Check = animated("Check", HugeiconsCheckIcon);
export const CheckIcon = animated("CheckIcon", HugeiconsCheckIcon);
export const ChatCircleText = animated("ChatCircleText", HugeiconsMailIcon);
export const Copy = staticAnimated("Copy");
export const ChevronDownIcon = animated("ChevronDownIcon", HugeiconsChevronDownIcon);
export const ChevronRightIcon = animated("ChevronRightIcon", HugeiconsChevronRightIcon);
export const ChevronUpIcon = animated("ChevronUpIcon", HugeiconsChevronUpIcon);
export const Eye = animated("Eye", HugeiconsEyeIcon);
export const FileArrowDown = animated("FileArrowDown", HugeiconsDownloadIcon);
export const Gear = animated("Gear", HugeiconsSettingsIcon);
export const House = animated("House", HugeiconsHomeIcon);
export const LockKey = animated("LockKey", HugeiconsLockIcon);
export const MagnifyingGlass = animated("MagnifyingGlass", HugeiconsSearchIcon);
export const MoreHorizontalIcon = animated("MoreHorizontalIcon", HugeiconsMenuIcon);
export const PencilSimple = animated("PencilSimple", HugeiconsPencilIcon);
export const HelpCircle = staticAnimated("HelpCircle");
export const Plus = animated("Plus", HugeiconsPlusIcon);
export const Share = animated("Share", HugeiconsShareIcon);
export const SlidersHorizontal = animated("SlidersHorizontal", HugeiconsFilterIcon);
export const Trash = animated("Trash", HugeiconsTrashIcon);
export const Users = animated("Users", HugeiconsUserIcon);
export const UsersThree = animated("UsersThree", HugeiconsUserIcon);
export const X = animated("X", HugeiconsXIcon);
export const XIcon = animated("XIcon", HugeiconsXIcon);
export const ArrowUpRight = animated("ArrowUpRight", HugeiconsArrowUpRightIcon);
export const ArrowsClockwise = animated("ArrowsClockwise", HugeiconsRefreshIcon);
export const ShieldCheck = animated("ShieldCheck", HugeiconsShieldCheckIcon);
export const XCircle = animated("XCircle", HugeiconsXCircleIcon);

// ── Static icons with motion hover ───────────────────────────────────-
// These use HugeiconsIcon wrapped in a motion.span for gentle hover-scale
export const ArrowDownRight = staticAnimated("ArrowDownRight");
export const ArrowSquareOut = staticAnimated("ArrowSquareOut");
export const ArrowsDownUp = staticAnimated("ArrowsDownUp");

export const BookOpen = staticAnimated("BookOpen");
export const Buildings = staticAnimated("Buildings");
export const Calculator = staticAnimated("Calculator");
export const ChartBar = staticAnimated("ChartBar");
export const ChartLineUp = staticAnimated("ChartLineUp");
export const CheckCircle = staticAnimated("CheckCircle");
export const Circle = staticAnimated("Circle");
export const CircleCheckIcon = staticAnimated("CircleCheckIcon");
export const CircleDashed = staticAnimated("CircleDashed");
export const ClipboardText = staticAnimated("ClipboardText");
export const Clock = staticAnimated("Clock");
export const Compass = staticAnimated("Compass");
export const CreditCard = staticAnimated("CreditCard");
export const CurrencyCircleDollar = staticAnimated("CurrencyCircleDollar");
export const Database = staticAnimated("Database");
export const DotsThreeVertical = staticAnimated("DotsThreeVertical");
export const EyeSlash = staticAnimated("EyeSlash");
export const FileText = staticAnimated("FileText");
export const Fingerprint = staticAnimated("Fingerprint");
export const Flag = staticAnimated("Flag");
export const FolderSimple = staticAnimated("FolderSimple");
export const Globe = staticAnimated("Globe");
export const Handshake = staticAnimated("Handshake");
export const InfoIcon = staticAnimated("InfoIcon");
export const Key = staticAnimated("Key");
export const Lightning = staticAnimated("Lightning");
export const LinkSimple = staticAnimated("LinkSimple");
export const ListChecks = staticAnimated("ListChecks");
export const Loader2Icon = staticAnimated("Loader2Icon");
export const MagicWand = staticAnimated("MagicWand");
export const Monitor = staticAnimated("Monitor");
export const MoonStars = staticAnimated("MoonStars");
export const Note = staticAnimated("Note");
export const OctagonXIcon = staticAnimated("OctagonXIcon");
export const PaperPlaneTilt = staticAnimated("PaperPlaneTilt");
export const Pause = staticAnimated("Pause");
export const Phone = staticAnimated("Phone");
export const PiggyBank = staticAnimated("PiggyBank");
export const Plug = staticAnimated("Plug");
export const PanelLeftIcon = staticAnimated("PanelLeftIcon");
export const Power = staticAnimated("Power");
export const Quotes = staticAnimated("Quotes");
export const RoadHorizon = staticAnimated("RoadHorizon");
export const RocketLaunch = staticAnimated("RocketLaunch");
export const SealCheck = staticAnimated("SealCheck");

export const ShieldStar = staticAnimated("ShieldStar");
export const ShieldWarning = staticAnimated("ShieldWarning");
export const SignOut = staticAnimated("SignOut");
export const SquaresFour = staticAnimated("SquaresFour");
export const SunDim = staticAnimated("SunDim");
export const Target = staticAnimated("Target");
export const TrendDown = staticAnimated("TrendDown");
export const TrendUp = staticAnimated("TrendUp");
export const TriangleAlertIcon = staticAnimated("TriangleAlertIcon");
export const UserList = staticAnimated("UserList");
export const UserPlus = staticAnimated("UserPlus");
export const UserCircle = staticAnimated("UserCircle");
export const UserSwitch = staticAnimated("UserSwitch");
export const Warning = staticAnimated("Warning");
export const WarningCircle = staticAnimated("WarningCircle");
export const WhatsappLogo = staticAnimated("WhatsappLogo");
export const WifiHigh = staticAnimated("WifiHigh");

export const Megaphone = staticAnimated("Megaphone");
export const ShareAll = staticAnimated("ShareAll");
export const Sparkle = staticAnimated("Sparkle");
export const Redistribute = staticAnimated("Redistribute");
export const ArrowsOut = staticAnimated("ArrowsOut");
export const ArrowsIn = staticAnimated("ArrowsIn");

export const RotateCcw = staticAnimated("RotateCcw");
export const UserCheck = staticAnimated("UserCheck");
export const Flame = staticAnimated("Flame");
export const ThermometerCold = staticAnimated("ThermometerCold");
export const ShieldX = staticAnimated("ShieldX");
