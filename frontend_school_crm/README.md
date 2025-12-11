# Private School Management System

A comprehensive, modern web application for managing all aspects of private school operations including students, teachers, classes, payments, salaries, and comprehensive financial reporting.

## 🌟 Key Features

### 🎓 Complete Student Management
- Add, edit, and delete student records
- Track student status (Active, Left, Suspended)
- Manage student enrollment and class assignments
- Monitor payment history and debts
- Parent contact information

### 👨‍🏫 Teacher Administration
- Manage teacher profiles and contact information
- Track subjects taught by each teacher
- Monitor salary payments
- Assign teachers to classes
- View teacher payment history

### 📚 Class Organization
- Create and organize classes
- Assign class teachers
- Track student enrollment per class
- Manage academic year information

### 💰 Advanced Financial Tracking
- Record student fee payments
- Generate invoice numbers automatically
- Track paid, unpaid, and partial payments
- Monitor total school income
- Identify students with outstanding debts

### 💼 Salary & Expense Management
- Record teacher salary payments
- Track paid and unpaid salaries
- Calculate total monthly expenses
- Monitor upcoming payouts

### 📊 Real-time Dashboard & Analytics
- Real-time financial overview
- Total income vs expenses
- Net profit calculation
- Pending payments and salaries
- Visual charts and graphs

### 📄 Professional Reporting
- Generate monthly and yearly reports
- Export reports to PDF
- Export data to CSV/Excel
- Comprehensive financial summaries
- Student payment reports
- Teacher salary reports

## 🚀 Technology Stack

- **Frontend**: Next.js 15.2, React 18.3, TypeScript
- **Styling**: Tailwind CSS v3.4
- **UI Components**: Shadcn/UI
- **Icons**: Lucide React
- **Data Storage**: localStorage (client-side)
- **Authentication**: Built-in role-based system

## 🎨 Design Features

- **Modern UI/UX**: Clean, intuitive interface built with Shadcn/UI components
- **Responsive Design**: Fully responsive across mobile, tablet, and desktop devices
- **Dark/Light Mode**: Automatic theme detection with manual toggle
- **Smooth Animations**: Professional transitions and micro-interactions
- **Accessibility**: WCAG AA compliant with keyboard navigation support

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🔐 Default Credentials

- **Email**: admin@school.com
- **Password**: admin123

## 📱 Features Overview

### Data Persistence
All data is stored in browser localStorage, allowing for:
- Offline functionality
- Fast data access
- No backend required for demo/testing
- Easy migration to database when needed

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimized
- Touch-friendly interface
- Adaptive navigation

### Dark/Light Theme
- System preference detection
- Manual theme switching
- Persistent theme selection
- Optimized for both modes

### Security Features
- Role-based access control
- Secure authentication flow
- Protected routes
- Session management

## 🏗️ Project Architecture

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # Shadcn UI components
│   ├── Layout.tsx    # Main layout wrapper
│   ├── ThemeSwitch.tsx
│   └── FinancialChart.tsx
├── pages/            # Next.js pages
│   ├── index.tsx     # Dashboard
│   ├── login.tsx     # Authentication
│   ├── students.tsx  # Student management
│   ├── teachers.tsx  # Teacher management
│   ├── classes.tsx   # Class management
│   ├── payments.tsx  # Payment tracking
│   ├── salaries.tsx  # Salary management
│   └── reports.tsx   # Reports & export
├── lib/              # Utility functions
│   ├── auth.ts       # Authentication logic
│   ├── storage.ts    # Data persistence
│   └── exportUtils.ts # Export functionality
├── types/            # TypeScript definitions
└── styles/           # Global styles

```

## 🔄 Data Management

The application uses browser localStorage for data persistence, making it:
- **Offline-first**: Works without internet connection
- **Fast**: Instant data access
- **Simple**: No backend configuration needed
- **Migratable**: Easy to switch to database backend

### Migration to Database

To migrate to a database backend:
1. Replace localStorage calls in `src/lib/storage.ts` with API calls
2. Set up backend server (Node.js/Express, Go, etc.)
3. Implement database schema (PostgreSQL recommended)
4. Update authentication to use JWT tokens
5. Deploy backend and update frontend API endpoints

## 🎯 Use Cases

- **Private Schools**: Complete school management solution
- **Training Centers**: Course and student tracking
- **Tutoring Services**: Session and payment management
- **Educational Institutions**: Administrative operations

## 🔮 Future Enhancements

- Database integration (PostgreSQL/Supabase)
- Email notifications
- SMS reminders for payments
- Attendance tracking
- Grade management
- Parent portal
- Mobile app
- Advanced analytics
- Multi-school support
- Cloud backup

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - See LICENSE file for details

## 💡 Support

For support, please open an issue on GitHub or contact the development team.

## 🙏 Acknowledgments

Built with modern web technologies and best practices for educational institutions worldwide.

---

**Version**: 1.0.0  
**Last Updated**: 2025  
**Status**: Production Ready ✅
