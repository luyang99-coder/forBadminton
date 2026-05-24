# Cloud Database Indexes

Collection: `activities`

Current activity list logic is intentionally simple:

- Deleted activities are permanently removed by `activityService.deleteActivity`.
- Legacy records with `deleted: true` are hidden.
- Home search only matches activity name, and keyword filtering is done in the cloud function after visibility filtering.

## Activity List

Create these indexes in WeChat Cloud Development Console before production use.

1. Owner activity list
   - `ownerOpenid` ascending
   - `deleted` ascending
   - `updatedAt` descending

2. Collaborator activity list
   - `adminOpenids` array
   - `deleted` ascending
   - `updatedAt` descending

3. Joined activity list
   - `participantOpenids` array
   - `deleted` ascending
   - `updatedAt` descending

4. Legacy joined activity list
   - `participants.openid` array
   - `deleted` ascending
   - `updatedAt` descending

## Notes

- Name search is kept lightweight for the current scale. If one user has hundreds of activities, add `searchText` or keyword tokens before querying.
- No recycle-bin indexes are required.
