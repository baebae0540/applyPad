/** 칸반 컬럼 자료구조. 목록 응답 ↔ 컬럼별 배열을 오가는 변환을 한곳에 모아둔다 */
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from "@/lib/types";

export type Columns = Record<ApplicationStatus, Application[]>;

const COLUMN_PREFIX = "column:";

/** 빈 컬럼도 드롭 대상이 되도록 컬럼 자체에 droppable id를 준다 */
export function columnDroppableId(status: ApplicationStatus): string {
  return `${COLUMN_PREFIX}${status}`;
}

function emptyColumns(): Columns {
  const columns = {} as Columns;
  for (const status of APPLICATION_STATUSES) columns[status] = [];
  return columns;
}

/** API가 상태(enum 순) → sortOrder 순으로 주므로 순서대로 쌓으면 컬럼 내 순서가 맞다 */
export function groupByStatus(applications: Application[]): Columns {
  const columns = emptyColumns();
  for (const application of applications) columns[application.status].push(application);
  return columns;
}

/** 카드 id 또는 컬럼 droppable id가 어느 컬럼에 속하는지 찾는다 */
export function findColumn(columns: Columns, id: string): ApplicationStatus | null {
  if (id.startsWith(COLUMN_PREFIX)) {
    const status = id.slice(COLUMN_PREFIX.length) as ApplicationStatus;
    return status in columns ? status : null;
  }
  return APPLICATION_STATUSES.find((status) => columns[status].some((app) => app.id === id)) ?? null;
}

/** 낙관적 업데이트용: 컬럼 상태를 목록 응답 형태(status·sortOrder 반영)로 되돌린다 */
export function flattenColumns(columns: Columns): Application[] {
  return APPLICATION_STATUSES.flatMap((status) =>
    columns[status].map((application, index) => ({ ...application, status, sortOrder: index })),
  );
}
