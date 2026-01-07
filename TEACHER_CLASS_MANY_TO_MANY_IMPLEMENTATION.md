# Many-to-Many Teacher-Class Implementation

This document describes the implementation of a many-to-many relationship between Teachers and Classes using the `teacher_classes` junction table.

## Changes Made

### Backend Changes

#### 1. **models.go** - Updated Class Model
- Added `TeacherIDs []string` field to store multiple teacher IDs
- Keeps existing `TeacherID` field for backward compatibility (primary teacher)

#### 2. **class_service.go** - Updated Class Service
- Modified `CreateClassRequest` to accept `TeacherIDs` array
- Updated `Create()` method to insert teacher-class associations
- Updated `GetByID()` and `GetByBranchID()` to load teachers from `teacher_classes` table
- Updated `Update()` method to handle teacher updates
- Added helper methods:
  - `addTeacherToClass()` - Add teacher to class
  - `removeTeacherFromClass()` - Remove teacher from class
  - `getClassTeachers()` - Get all teachers for a class
  - `UpdateTeachers()` - Update all teachers for a class

#### 3. **teacher_service.go** - Updated Teacher Service
- Updated `GetByID()` and `GetByBranchID()` to load assigned classes from `teacher_classes` table
- Added `getTeacherClasses()` helper method to fetch assigned classes

### Frontend Changes

#### 1. **types/index.ts** - Updated Type Definitions
- Added `teacherIds?: string[]` to `Class` interface

#### 2. **lib/api.ts** - Updated API Types
- Added `teacherIds?: string[]` to `Class` interface
- Added `teacherIds?: string[]` to `CreateClassRequest` interface

#### 3. **pages/classes.tsx** - Updated Class Management
- Updated form state to include `teacherIds: [] as string[]`
- Modified create/update handlers to send `teacherIds`
- Changed form to include:
  - Primary Teacher dropdown (single select)
  - Additional Teachers checkboxes (multi-select)
- Updated `handleEdit()` to load `teacherIds`
- Updated `resetForm()` to clear `teacherIds`

## Database Schema

The implementation uses the existing `teacher_classes` junction table:

```sql
CREATE TABLE teacher_classes (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, class_id)
);
```

## API Endpoints

### Create Class (POST /classes)
```json
{
  "name": "7A",
  "teacherId": "teacher-id-1",
  "teacherIds": ["teacher-id-1", "teacher-id-2"],
  "branchId": "branch-id"
}
```

### Update Class (PUT /classes/:id)
```json
{
  "name": "7A",
  "teacherId": "teacher-id-1",
  "teacherIds": ["teacher-id-1", "teacher-id-2"]
}
```

### Get Class Response
```json
{
  "id": "class-id",
  "name": "7A",
  "teacherId": "teacher-id-1",
  "teacherIds": ["teacher-id-1", "teacher-id-2"],
  "studentIds": [],
  "branchId": "branch-id",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Features

1. **Primary Teacher** - Single teacher selected via dropdown (for backward compatibility)
2. **Additional Teachers** - Multiple teachers can be assigned via checkboxes
3. **Bidirectional** - Teachers show their assigned classes, Classes show their assigned teachers
4. **Auto-Sync** - When updating classes, the many-to-many relationship is automatically maintained

## Usage Flow

### For Administrators
1. Go to Classes section
2. Create or edit a class
3. Select a Primary Teacher (optional)
4. Check Additional Teachers to add multiple teachers
5. Save - the system automatically creates/updates the `teacher_classes` records

### For Teachers
1. Teachers can see all classes they are assigned to in their profile
2. Teachers can view students in their assigned classes

## Future Enhancements

- Add role-based access (teachers can only see their own classes)
- Add class assignment validation
- Add bulk teacher assignment
- Add teacher-class history/audit trail
