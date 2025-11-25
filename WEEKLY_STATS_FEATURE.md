# Weekly Query Statistics Feature

## Overview
This feature displays the number of user queries answered in the past week on the main page UI.

## Implementation Details

### API Endpoint
**Path**: `/api/stats/weekly-queries`  
**Method**: GET  
**Authentication**: Not required (public endpoint)

**Response Format**:
```json
{
  "count": 42
}
```

**Error Response**:
```json
{
  "error": "Failed to fetch query statistics"
}
```

### Algorithm
1. Calculate the date 7 days ago from now
2. Query MongoDB for all chats with messages that have timestamps >= 7 days ago
3. Iterate through all messages and count only those where:
   - `role === "user"` (excludes system and assistant messages)
   - `timestamp >= sevenDaysAgo`
4. Return the total count

### UI Component
**Component**: `WeeklyStats`  
**Location**: `components/WeeklyStats.tsx`

**Features**:
- Fetches data from API endpoint on mount
- Shows loading skeleton while fetching
- Displays: "上周，法律AI 已帮助解答了 X 个用户查询"
- Gracefully handles errors by hiding the component
- Styled with gradient background and chart icon

**Integration**: Added to the sidebar in `app/page.tsx`, displayed to all users

### Testing
Test file: `__tests__/api/weekly-queries.test.ts`

**Test Coverage**:
- ✅ Successful query counting
- ✅ Error handling
- ✅ Date filtering (only counts queries from past 7 days)
- ✅ Role filtering (only counts user messages)
- ✅ Zero count scenario

## Usage
The statistic is automatically displayed on the main page sidebar. No user action required.

## Performance Considerations
- Query uses MongoDB index on `messages.timestamp` for efficient filtering
- Component fetches data once on mount (no polling)
- Error states are handled silently to not disrupt user experience

## Future Enhancements
- Add caching to reduce database queries
- Add more granular time periods (daily, monthly)
- Add breakdown by user type (authenticated vs guest)
- Add trend indicators (up/down from previous week)
