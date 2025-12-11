# Classes Page Multi-Select & Move to Class Feature

## Overview
Added functionality to select and move students from the "Unassigned Students" section to a class with two methods:
1. **Drag-and-Drop** - iPhone style (mouse/touch drag)
2. **Multi-Select** - Checkbox selection with bulk move button

## Implementation Details

### 1. **Updated Student Type** (`src/types/index.ts`)
Added two new optional fields to track class assignment confirmation:
```typescript
export interface Student {
  // ... existing fields ...
  classSignedDate?: string;      // ISO timestamp of when student was signed to class
  classConfirmed?: boolean;      // Flag indicating student has been confirmed to class
}
```

### 2. **New State Variables** (`src/pages/classes.tsx`)
```typescript
const [unassignedSelection, setUnassignedSelection] = useState<string[]>([]);
const [moveToClassDialog, setMoveToClassDialog] = useState(false);
const [targetClassId, setTargetClassId] = useState<string>("");
```

### 3. **Drag-and-Drop Handler Functions**

#### `handleDragStart(student: Student)`
- Initiates drag operation
- Stores the dragged student in state
- Updates cursor to grabbing state

#### `handleDragEnd()`
- Resets drag state when drag completes
- Clears dragged student and hover class
- Resets visual effects

#### `handleDragOver(e: React.DragEvent, classId: string)`
- Prevents default behavior (allows drop)
- Sets drop effect to "move"
- Highlights the class being dragged over
- Shows visual feedback (green ring and glow)

#### `handleDragLeave()`
- Clears hover state when leaving a drop zone
- Removes highlighting

#### `handleDropOnClass(classId: string)`
- Final handler when student is dropped on class
- Shows confirmation dialog
- Updates student with:
  - `classId`: Target class
  - `classConfirmed: true`: Marks as confirmed
  - `classSignedDate`: Current timestamp
- Shows success toast
- Resets drag state

### 4. **New Handler Functions (Multi-Select)**

#### `toggleUnassignedSelection(studentId: string)`
- Toggles a single student's selection in the unassigned list
- Updates `unassignedSelection` state

#### `toggleSelectAllUnassigned()`
- Selects/deselects all unassigned students at once
- Used by the "Select All" checkbox in the header

#### `handleMoveToClass()`
- Main function that moves selected students to a class
- **Includes confirmation dialog** asking user to confirm action
- **Updates students with:**
  - `classId`: Target class ID
  - `classConfirmed: true`: Marks student as confirmed to class
  - `classSignedDate`: Current timestamp (automatic signing)
- Shows success toast with count of students moved
- Clears selection and closes dialog

### 5. **Updated Class Cards for Drag-and-Drop**
- Added drag event handlers to class cards
- Class cards are drop zones (draggable={false})
- Visual feedback when hovering with a student:
  - Green ring border (ring-4 ring-green-400)
  - Green-tinted background
  - Increased shadow effect
  - Inline hint showing which student is being dropped
- Cards show "Drop here to add [Student Name]" when dragging

### 6. **Updated Unassigned Students Section UI**

#### Card Header
- Shows unassigned student count
- When students are selected, displays "Move to Class" button showing count of selected students

#### Move to Class Dialog
- Appears when user clicks "Move to Class" button
- Shows summary of selected students
- Requires selecting a target class from dropdown
- Displays confirmation message explaining students will be "moved and signed to the class"
- Has Cancel and Confirm & Move buttons

#### Student List
- Changed from grid layout to table-like layout with dividers
- Each student row is **draggable**:
  - Cursor changes to grab/grabbing hand
  - Can be dragged to class cards
  - Blue highlight when being dragged (50% opacity)
  - Visual feedback with border and background
- Checkbox selection for multi-select mode:
  - Checkbox for selection
  - Student name
  - Phone and monthly payment info
  - "📱 Drag to move" hint
  - Highlights in orange when selected
- "Select All" header checkbox
- Hover effects for better UX

### 5. **Confirmation Behavior**
- User selects students from unassigned list
- Clicks "Move to Class" button
- Chooses target class from dropdown
- Confirms action with browser confirmation dialog
- If confirmed:
  - Students are assigned to the class
  - Marked as confirmed (`classConfirmed: true`)
  - Signed with current timestamp
  - Success message displayed
  - Selection cleared

## UI/UX Features

### Drag-and-Drop
✓ iPhone-style drag and drop  
✓ Works with mouse (desktop) and touch (mobile/tablet)  
✓ Visual feedback (blue outline when dragging, green highlight on drop zone)  
✓ Cursor changes (grab/grabbing hand)  
✓ Drop zone hints ("Drop here to add [Name]")  
✓ Confirmation dialog before assigning  
✓ Automatic signing on drop  

### Multi-Select
✓ Checkbox selection for multiple students  
✓ Select All/Deselect All functionality  
✓ Visual highlighting of selected students (orange background)  
✓ "Move to Class" button (appears when students selected)  
✓ Class selection in dialog  

### General
✓ Confirmation dialogs for data changes  
✓ Success/error toast notifications  
✓ Class roster info in dropdown  
✓ Permission checks before allowing actions  
✓ Responsive design (works on mobile/tablet/desktop)  
✓ Hints and visual guidance (📱 Drag to move)  

## Permissions Required
- Must have `canEditClasses` permission to:
  - Move students to classes
  - Use the bulk assignment feature

## Files Modified
1. `src/types/index.ts` - Added new Student fields
2. `src/pages/classes.tsx` - Added multi-select UI and handlers

## How to Use

### Method 1: Drag-and-Drop (iPhone Style) 🎯

1. **Navigate to Classes page**
2. **Scroll to "Unassigned Students" section** at the bottom
3. **Find a student** you want to move
4. **Drag the student card** to a class card above
   - Mouse: Click and drag
   - Touch/Mobile: Long press and drag
5. **Drop on a class** - it will highlight in green
6. **Confirm in the dialog** - "Move [Student] to [Class]?"
7. **Student is signed!** - Success toast confirms

### Method 2: Multi-Select with Button 📋

1. **Navigate to Classes page**
2. **Scroll to "Unassigned Students" section** at the bottom
3. **Select students** using checkboxes
   - Click individual checkboxes or click the row
   - Use "Select All" to select everyone
4. **Click "Move to Class" button** (appears when students are selected)
5. **Select target class** from dropdown in dialog
6. **Click "Confirm & Move"** button
7. **Students are signed!** - Success toast shows count

## Notes
- Unsigned/unassigned students are those without a class assignment
- Only active students are shown in the list
- Confirmation is immediate - students are signed automatically upon moving
- The system tracks when students were signed via `classSignedDate`
- A student can only be in one class at a time
