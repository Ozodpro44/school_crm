#!/bin/bash

# School CRM Backend - Example API Calls
# Usage: Source this file to use the functions

API_URL="http://localhost:8080/api"
TOKEN=""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
  echo -e "${BLUE}$1${NC}"
}

print_success() {
  echo -e "${GREEN}$1${NC}"
}

print_error() {
  echo -e "${RED}$1${NC}"
}

# ============================================================================
# AUTHENTICATION EXAMPLES
# ============================================================================

register_user() {
  local email=$1
  local password=$2
  local fullName=$3
  local role=${4:-"manager"}
  
  print_info "Registering user: $email"
  
  curl -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\",
      \"fullName\": \"$fullName\",
      \"role\": \"$role\"
    }"
  
  echo ""
}

login() {
  local email=$1
  local password=$2
  
  print_info "Logging in as: $email"
  
  response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\"
    }")
  
  TOKEN=$(echo $response | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$TOKEN" ]; then
    print_error "Login failed"
    echo $response
  else
    print_success "Login successful. Token: ${TOKEN:0:20}..."
  fi
  
  echo $response
  echo ""
}

# ============================================================================
# BRANCH EXAMPLES
# ============================================================================

create_branch() {
  local name=$1
  local address=$2
  local phone=$3
  local monthlyPayment=${4:-100000}
  
  print_info "Creating branch: $name"
  
  curl -X POST "$API_URL/branches" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"address\": \"$address\",
      \"phone\": \"$phone\",
      \"monthlyPayment\": $monthlyPayment
    }"
  
  echo ""
}

list_branches() {
  print_info "Listing all branches"
  
  curl -s -X GET "$API_URL/branches" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

get_branch() {
  local branchId=$1
  
  print_info "Getting branch: $branchId"
  
  curl -s -X GET "$API_URL/branches/$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# CLASS EXAMPLES
# ============================================================================

create_class() {
  local name=$1
  local branchId=$2
  local teacherId=${3:-""}
  
  print_info "Creating class: $name"
  
  curl -X POST "$API_URL/classes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"branchId\": \"$branchId\",
      \"teacherId\": \"$teacherId\"
    }"
  
  echo ""
}

list_classes() {
  local branchId=$1
  
  print_info "Listing classes for branch: $branchId"
  
  curl -s -X GET "$API_URL/classes?branchId=$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# STUDENT EXAMPLES
# ============================================================================

create_student() {
  local fullName=$1
  local classId=$2
  local phone=$3
  local parentPhone=$4
  local monthlyPayment=$5
  local branchId=$6
  
  print_info "Creating student: $fullName"
  
  curl -X POST "$API_URL/students" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"fullName\": \"$fullName\",
      \"classId\": \"$classId\",
      \"phone\": \"$phone\",
      \"parentPhone\": \"$parentPhone\",
      \"monthlyPayment\": $monthlyPayment,
      \"status\": \"active\",
      \"branchId\": \"$branchId\",
      \"enrollmentDate\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"
    }"
  
  echo ""
}

list_students() {
  local branchId=$1
  
  print_info "Listing students for branch: $branchId"
  
  curl -s -X GET "$API_URL/students?branchId=$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

get_student() {
  local studentId=$1
  
  print_info "Getting student: $studentId"
  
  curl -s -X GET "$API_URL/students/$studentId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# PAYMENT EXAMPLES
# ============================================================================

create_payment() {
  local studentId=$1
  local amount=$2
  local month=$3
  local year=$4
  local paymentMethod=${5:-"cash"}
  local branchId=$6
  
  local invoiceNumber="INV-$(date +%s)"
  
  print_info "Recording payment for student: $studentId"
  
  curl -X POST "$API_URL/payments" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"studentId\": \"$studentId\",
      \"amount\": $amount,
      \"month\": \"$month\",
      \"year\": $year,
      \"paymentMethod\": \"$paymentMethod\",
      \"status\": \"paid\",
      \"invoiceNumber\": \"$invoiceNumber\",
      \"paidDate\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",
      \"branchId\": \"$branchId\"
    }"
  
  echo ""
}

list_payments() {
  local branchId=$1
  
  print_info "Listing payments for branch: $branchId"
  
  curl -s -X GET "$API_URL/payments?branchId=$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

get_payment_summary() {
  local branchId=$1
  
  print_info "Getting payment summary for branch: $branchId"
  
  curl -s -X GET "$API_URL/payments/branch/$branchId/summary" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# TEACHER EXAMPLES
# ============================================================================

create_teacher() {
  local fullName=$1
  local phone=$2
  local email=$3
  local monthlySalary=$4
  local branchId=$5
  local subjects=${6:-"Mathematics,Physics"}
  
  print_info "Creating teacher: $fullName"
  
  # Convert comma-separated subjects to JSON array
  subjects_json="[\"$(echo $subjects | sed 's/,/","/g')\"]"
  
  curl -X POST "$API_URL/teachers" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"fullName\": \"$fullName\",
      \"phone\": \"$phone\",
      \"email\": \"$email\",
      \"monthlySalary\": $monthlySalary,
      \"branchId\": \"$branchId\",
      \"subjects\": $subjects_json,
      \"joinedDate\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"
    }"
  
  echo ""
}

list_teachers() {
  local branchId=$1
  
  print_info "Listing teachers for branch: $branchId"
  
  curl -s -X GET "$API_URL/teachers?branchId=$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# SALARY EXAMPLES
# ============================================================================

create_salary() {
  local teacherId=$1
  local amount=$2
  local month=$3
  local year=$4
  local paymentMethod=${5:-"bank"}
  local branchId=$6
  
  print_info "Recording salary for teacher: $teacherId"
  
  curl -X POST "$API_URL/salaries" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"teacherId\": \"$teacherId\",
      \"amount\": $amount,
      \"month\": \"$month\",
      \"year\": $year,
      \"paymentMethod\": \"$paymentMethod\",
      \"status\": \"paid\",
      \"paidDate\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",
      \"branchId\": \"$branchId\"
    }"
  
  echo ""
}

list_salaries() {
  local branchId=$1
  
  print_info "Listing salaries for branch: $branchId"
  
  curl -s -X GET "$API_URL/salaries?branchId=$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# EXPENSE EXAMPLES
# ============================================================================

create_expense() {
  local title=$1
  local description=$2
  local amount=$3
  local category=$4
  local paymentMethod=${5:-"cash"}
  local branchId=$6
  
  print_info "Creating expense: $title"
  
  curl -X POST "$API_URL/expenses" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"$title\",
      \"description\": \"$description\",
      \"amount\": $amount,
      \"category\": \"$category\",
      \"paymentMethod\": \"$paymentMethod\",
      \"date\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",
      \"branchId\": \"$branchId\"
    }"
  
  echo ""
}

list_expenses() {
  local branchId=$1
  
  print_info "Listing expenses for branch: $branchId"
  
  curl -s -X GET "$API_URL/expenses?branchId=$branchId" \
    -H "Authorization: Bearer $TOKEN" | jq .
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

health_check() {
  print_info "Checking API health"
  curl -s http://localhost:8080/health | jq .
}

set_token() {
  TOKEN=$1
  print_success "Token set: ${TOKEN:0:20}..."
}

show_token() {
  print_info "Current token: $TOKEN"
}

show_usage() {
  cat << 'EOF'

School CRM Backend - Example Commands

Authentication:
  register_user <email> <password> <fullName> [role]
  login <email> <password>
  set_token <token>
  show_token

Branches:
  create_branch <name> <address> <phone> [monthlyPayment]
  list_branches
  get_branch <branchId>

Classes:
  create_class <name> <branchId> [teacherId]
  list_classes <branchId>

Students:
  create_student <fullName> <classId> <phone> <parentPhone> <monthlyPayment> <branchId>
  list_students <branchId>
  get_student <studentId>

Payments:
  create_payment <studentId> <amount> <month> <year> [paymentMethod] <branchId>
  list_payments <branchId>
  get_payment_summary <branchId>

Teachers:
  create_teacher <fullName> <phone> <email> <monthlySalary> <branchId> [subjects]
  list_teachers <branchId>

Salaries:
  create_salary <teacherId> <amount> <month> <year> [paymentMethod] <branchId>
  list_salaries <branchId>

Expenses:
  create_expense <title> <description> <amount> <category> [paymentMethod] <branchId>
  list_expenses <branchId>

Utility:
  health_check
  show_usage

Example Usage:
  1. health_check
  2. register_user admin@example.com password123 "Admin User" admin
  3. login admin@example.com password123
  4. create_branch "Main School" "123 Main St" "998901234567" 100000
  5. list_branches

EOF
}

# Show usage on source
print_info "School CRM Backend - Example Commands Loaded"
print_info "Type 'show_usage' to see available commands"
