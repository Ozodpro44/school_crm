# Drag & Drop Students to Classes - iPhone Style

## Overview
Move students between unassigned list and classes using drag-and-drop, just like moving apps on an iPhone. Works on desktop (mouse), tablet (touch), and mobile (long press + drag).

## How to Use

### Desktop (Mouse)
1. Hover over an unassigned student - you'll see the cursor change to a **grab hand** (👆)
2. **Click and drag** the student card to any class
3. The class card will highlight in **green** when you drag over it
4. **Drop** the student on the class
5. **Confirm** the action in the confirmation dialog
6. Student is automatically **signed** to the class!

### Mobile/Tablet (Touch)
1. **Long press** (press and hold) on a student card
2. **Drag** your finger to a class card
3. The class will highlight in green as you drag over it
4. **Release** to drop
5. Confirm in the dialog
6. Done!

## Visual Feedback

### Student Card States
- **Normal**: Light gray background, "grab" cursor
- **Dragging**: Blue background, 50% opacity, blue border (showing it's being moved)
- **Selected**: Orange background (when using checkboxes)

### Class Card States
- **Ready to Drop**: Normal appearance
- **Drag Over**: 
  - Green ring around card
  - Green tinted background
  - Shadow effect increases
  - Shows "Drop here to add [Student Name]" text
  - Student name is shown in the tooltip

## Features

✓ Drag-and-drop with visual feedback  
✓ Works with mouse and touch  
✓ Real-time hover effects  
✓ Confirmation dialog for safety  
✓ Auto-signing students to class  
✓ Toast notifications for success/errors  
✓ Permission checks  
✓ Cursor changes (grab/grabbing)  
✓ Visual hints ("📱 Drag to move")  
✓ Drop zone highlighting  

## Technical Implementation

### State Management
```typescript
const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
const [draggedOverClass, setDraggedOverClass] = useState<string | null>(null);
```

### Key Handlers
- `handleDragStart(student)` - Triggered when you start dragging
- `handleDragEnd()` - Triggered when you release
- `handleDragOver(e, classId)` - Triggered while dragging over a class
- `handleDragLeave()` - Triggered when leaving a drop zone
- `handleDropOnClass(classId)` - Triggered when dropping on a class

### Confirmation Flow
1. User drags student to class
2. System shows: "Move [Student] to [Class]? They will be signed to this class."
3. User confirms
4. Student is assigned and signed with timestamp
5. Success toast shows the action completed

## Styling Classes

### Dragging Student
```
Blue background (bg-blue-100)
Blue border (border-blue-400)
Reduced opacity (50%)
```

### Drop Zone (Active)
```
Green ring (ring-4 ring-green-400)
Green tinted background (bg-green-50)
Enhanced shadow (shadow-2xl)
```

## Mobile Support
- Native HTML5 drag-drop with touch support
- Works on iOS Safari, Chrome, Firefox
- No third-party libraries needed
- Falls back gracefully on unsupported browsers

## Notes
- Only unassigned students can be dragged
- Students can only be in one class at a time
- Dragging is disabled on class cards (read-only drop zones)
- Confirmation is required before assigning
- Requires `canEditClasses` permission

## Keyboard Accessibility
While drag-drop doesn't support keyboard natively, users can still:
- Use the "Move to Class" button (visible when students selected)
- Use the bulk assign dialog from the header
- Use the multi-select feature

## Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 13+)
- Mobile browsers: Full touch support

## Common Issues

**Drag not working?**
- Make sure the student is from the unassigned section
- Try a longer press on mobile devices
- Check if you have `canEditClasses` permission

**Drop not working?**
- Ensure you're dropping on a class card (not in empty space)
- Make sure the class card is highlighted in green
- Try again with a slower drag motion

**On mobile/touch devices:**
- Use long press (press and hold for 500ms+)
- Drag smoothly to the target
- Release on the class card
