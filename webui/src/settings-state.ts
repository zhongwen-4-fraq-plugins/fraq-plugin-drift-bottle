export type RestartNoticeAction = 'hide' | 'preserve' | 'show';

export function restartNoticeAction(
  previousWebuiPath: string | undefined,
  nextWebuiPath: string,
  restartRequired: boolean,
): RestartNoticeAction {
  if (!restartRequired) return 'hide';
  return nextWebuiPath === previousWebuiPath ? 'preserve' : 'show';
}
