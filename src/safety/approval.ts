import { Notify } from "../ui/notifications";

/**
 * Human-in-the-loop approval gate (PRD 2.2 & 15.4).
 * Default selection is never destructive: VS Code modal buttons are ordered
 * with the safe choice first, and dismissal counts as "no".
 */

export type ApprovalChoice = "approve" | "details" | "cancel";

export interface ApprovalOptions {
  /** The primary affirmative button label, e.g. "Apply Patch". */
  approveLabel?: string;
  /** Optional middle button, e.g. "Open Diff". */
  detailsLabel?: string;
}

export async function requestApproval(
  message: string,
  options: ApprovalOptions = {}
): Promise<ApprovalChoice> {
  const approveLabel = options.approveLabel ?? "Approve";
  const buttons = options.detailsLabel
    ? [approveLabel, options.detailsLabel]
    : [approveLabel];

  // Modal so the user must make a deliberate choice.
  const picked = await Notify.warnModal(message, ...buttons);

  if (picked === approveLabel) {
    return "approve";
  }
  if (options.detailsLabel && picked === options.detailsLabel) {
    return "details";
  }
  return "cancel";
}
