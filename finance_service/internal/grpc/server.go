// Package grpc implements the FinanceService gRPC server defined in
// protos/finance/v1/finance.proto. The generated stubs are now compiled in
// (see protos/go.mod) and actually registered — previously this package
// defined a parallel hand-rolled interface (a different RPC name,
// GetExpenseSummary, not in the proto at all) that was never registered
// with the underlying grpc.Server, so the server accepted TCP connections
// but answered every real RPC with Unimplemented.
package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	financev1 "github.com/school-crm/protos/finance/v1"

	"github.com/school-crm/finance-service/internal/service"
	commonv1 "github.com/school-crm/protos/common/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type FinanceGRPCServer struct {
	financev1.UnimplementedFinanceServiceServer
	expenses *service.ExpenseService
	grpc     *grpc.Server
}

func NewFinanceGRPCServer(expenses *service.ExpenseService) *FinanceGRPCServer {
	s := &FinanceGRPCServer{expenses: expenses, grpc: grpc.NewServer()}
	financev1.RegisterFinanceServiceServer(s.grpc, s)
	return s
}

// GetFinancialSummary returns expense totals for a branch+period.
//
// The proto models a full income-vs-expenses summary (total_income,
// net_profit), but finance_service only owns expenses today — there is no
// income tracking anywhere in this codebase yet. total_income is reported
// as 0 and net_profit as -total_expenses until income tracking exists,
// rather than fabricating a number. The request's date range is
// month-grained here (start_date's month/year), matching
// ExpenseService.Summary — end_date is accepted per the proto but not yet
// used for a true range query.
func (s *FinanceGRPCServer) GetFinancialSummary(ctx context.Context, req *financev1.GetFinancialSummaryRequest) (*financev1.GetFinancialSummaryResponse, error) {
	month, year := "", ""
	if req.GetStartDate() != "" {
		if t, err := time.Parse(time.RFC3339, req.GetStartDate()); err == nil {
			month = fmt.Sprintf("%02d", int(t.Month()))
			year = fmt.Sprintf("%d", t.Year())
		}
	}

	summary, err := s.expenses.Summary(ctx, req.GetBranchId(), month, year)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "expense summary: %v", err)
	}

	var monthNum, yearNum int32
	if t, err := time.Parse(time.RFC3339, req.GetStartDate()); err == nil {
		monthNum, yearNum = int32(t.Month()), int32(t.Year())
	}

	return &financev1.GetFinancialSummaryResponse{
		Summary: &financev1.FinancialSummary{
			TotalIncome:   0,
			TotalExpenses: summary.TotalAmount,
			NetProfit:     -summary.TotalAmount,
			Month:         monthNum,
			Year:          yearNum,
			BranchId:      req.GetBranchId(),
		},
	}, nil
}

// ListExpenses returns paginated expenses for a branch, filtered by
// category and (month-grained, from start_date) period.
func (s *FinanceGRPCServer) ListExpenses(ctx context.Context, req *financev1.ListExpensesRequest) (*financev1.ListExpensesResponse, error) {
	month, year := "", ""
	if req.GetStartDate() != "" {
		if t, err := time.Parse(time.RFC3339, req.GetStartDate()); err == nil {
			month = fmt.Sprintf("%02d", int(t.Month()))
			year = fmt.Sprintf("%d", t.Year())
		}
	}

	page, limit := 1, 20
	if p := req.GetPage(); p != nil {
		if p.GetPage() > 0 {
			page = int(p.GetPage())
		}
		if p.GetLimit() > 0 {
			limit = int(p.GetLimit())
		}
	}

	list, err := s.expenses.List(ctx, service.ListFilter{
		BranchID: req.GetBranchId(),
		Category: req.GetCategory(),
		Month:    month,
		Year:     year,
		Page:     page,
		Limit:    limit,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list expenses: %v", err)
	}

	items := make([]*financev1.Expense, 0, len(list.Items))
	for _, e := range list.Items {
		items = append(items, &financev1.Expense{
			ExpenseId:   e.ID,
			Title:       e.Title,
			Category:    e.Category,
			Amount:      e.Amount,
			BranchId:    e.BranchID,
			ExpenseDate: timestamppb.New(e.Date),
			CreatedAt:   timestamppb.New(e.CreatedAt),
		})
	}

	return &financev1.ListExpensesResponse{
		Expenses: items,
		Page: &commonv1.PageResponse{
			Total: int32(list.Total),
			Page:  int32(list.Page),
			Limit: int32(list.Limit),
		},
	}, nil
}

func (s *FinanceGRPCServer) Serve(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return s.grpc.Serve(lis)
}

func (s *FinanceGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
