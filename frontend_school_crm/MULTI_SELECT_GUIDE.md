# Multi-Select Implementation Guide

This guide shows how to add multi-select functionality to data list pages.

## Quick Implementation Steps

### 1. Add Hook Import
```typescript
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
```

### 2. Initialize Hook
```typescript
const {
  toggleSelect,
  toggleSelectAll,
  clearSelection,
  isSelected,
  getSelectedCount,
  getSelectedIds,
  areAllSelected,
  areSomeSelected,
} = useMultiSelect<YourDataType>();
```

### 3. Add Bulk Delete Function
```typescript
const handleBulkDelete = () => {
  const selectedIds = getSelectedIds();
  if (selectedIds.length === 0) return;

  if (confirm(`Are you sure? (${selectedIds.length} items)`)) {
    selectedIds.forEach((id) => yourDB.delete(id));
    clearSelection();
    loadData();
    toast({
      title: "Deleted",
      description: `${selectedIds.length} items deleted`,
      variant: "success",
    });
  }
};
```

### 4. Add Bulk Action UI
Add this before the table card:
```typescript
{getSelectedCount() > 0 && (
  <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
    <CardContent className="py-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">
          {getSelectedCount()} items selected
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
          Delete Selected
        </Button>
        <Button size="sm" variant="outline" onClick={clearSelection}>
          Cancel
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

### 5. Add Checkbox to Table Header
```typescript
<thead>
  <tr className="border-b border-slate-200 dark:border-slate-800">
    <th className="text-left py-3 px-4">
      <Checkbox
        checked={areAllSelected(items) || areSomeSelected(items)}
        onCheckedChange={() => toggleSelectAll(items)}
      />
    </th>
    {/* Other headers */}
  </tr>
</thead>
```

### 6. Add Checkbox to Table Rows
```typescript
<tbody>
  {items.map((item) => (
    <tr
      key={item.id}
      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
        isSelected(item.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
      }`}
    >
      <td className="py-3 px-4">
        <Checkbox
          checked={isSelected(item.id)}
          onCheckedChange={() => toggleSelect(item.id)}
        />
      </td>
      {/* Other columns */}
    </tr>
  ))}
</tbody>
```

## Hook API

- `toggleSelect(id)` - Toggle single item selection
- `toggleSelectAll(items)` - Toggle all items (if all selected, clear; otherwise select all)
- `clearSelection()` - Clear all selections
- `isSelected(id)` - Check if item is selected
- `getSelectedCount()` - Get number of selected items
- `getSelectedIds()` - Get array of selected IDs
- `areAllSelected(items)` - Check if all items are selected
- `areSomeSelected(items)` - Check if some (but not all) items are selected

## Pages with Multi-Select (✓ = done)

- ✓ Expenses
- ✓ Managers
- ✓ Students
- ✓ Teachers
- ✓ Class Details (Switch Students)
- [ ] Classes
- [ ] Payments
- [ ] Salaries
- [ ] Branches

## Recent Additions

### Class Details Page
- **Multi-select for switching students** - Use checkboxes to select multiple students and switch them to another class
- **Payment indicators** - Shows which students have paid for the current month with green checkmark
- **Payment summary** - Badge showing count of students who paid in the class header
- **Improved UI** - Replaced dropdown with clean table view showing student details during selection
