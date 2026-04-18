// Package grpc implements the FinanceService gRPC server.
package grpc

import (
	"context"
	"net"

	"github.com/school-crm/finance-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type GetExpenseSummaryRequest struct {
	BranchID string
	Month    string
	Year     string
}
type GetExpenseSummaryResponse struct {
	TotalAmount float64
	ByCategory  map[string]float64
}

type FinanceGRPCServer struct {
	expenses *service.ExpenseService
	grpc     *grpc.Server
}

func NewFinanceGRPCServer(expenses *service.ExpenseService) *FinanceGRPCServer {
	s := &FinanceGRPCServer{expenses: expenses, grpc: grpc.NewServer()}
	return s
}

// GetExpenseSummary returns expense totals for a branch+period.
// Called by finance_service consolidated dashboard endpoint.
func (s *FinanceGRPCServer) GetExpenseSummary(ctx context.Context, req *GetExpenseSummaryRequest) (*GetExpenseSummaryResponse, error) {
	summary, err := s.expenses.Summary(ctx, req.BranchID, req.Month, req.Year)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "expense summary: %v", err)
	}
	return &GetExpenseSummaryResponse{
		TotalAmount: summary.TotalAmount,
		ByCategory:  summary.ByCategory,
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
