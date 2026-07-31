/** Show OK/Cancel before a save or mutating action. Returns true only if the user clicks OK. */
export function confirmSave(message = "Are you sure you want to save?"): boolean {
  if (typeof window === "undefined") return true
  return window.confirm(message)
}
