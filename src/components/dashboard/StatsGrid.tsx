"use client";

/**
 * StatsGrid — Three-card summary strip for the dashboard.
 *
 * Displays key PRM metrics at a glance:
 *   1. Total Contacts  (Users icon)
 *   2. Pending Suggestions  (Lightbulb icon)
 *   3. Upcoming Meetings  (Calendar icon)
 *
 * Each card has a colored icon, numeric value, and label.
 */

import { Users, Lightbulb, Calendar } from "lucide-react";

interface StatsGridProps {
  /** Total number of contacts in the user's PRM */
  totalContacts: number;
  /** Number of AI suggestions awaiting user action */
  pendingSuggestions: number;
  /** Number of upcoming meetings on the calendar */
  upcomingMeetings: number;
}

export default function StatsGrid({
  totalContacts,
  pendingSuggestions,
  upcomingMeetings,
}: StatsGridProps) {
  /**
   * Stat card configuration array.
   * Each entry defines the label, value, icon component, and icon color
   * so we can render all three cards with a single map loop.
   */
  const stats = [
    {
      label: "Total Contacts",
      value: totalContacts,
      icon: Users,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      label: "Pending Suggestions",
      value: pendingSuggestions,
      icon: Lightbulb,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-50",
    },
    {
      label: "Upcoming Meetings",
      value: upcomingMeetings,
      icon: Calendar,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4"
        >
          {/* Icon container with colored background circle */}
          <div className={`p-3 rounded-full ${stat.bgColor}`}>
            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
          </div>

          {/* Numeric value and descriptive label */}
          <div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
