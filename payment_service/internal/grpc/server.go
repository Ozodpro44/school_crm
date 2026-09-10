// Package grpc implements the PaymentService gRPC server.
// Satisfies the contract defined in protos/payment/v1/payment.proto.
//
// Hand-rolled proto types are used until buf-generated stubs are published.
// When available, replace the manual interface with the generated stubs.
package grpc

import (
	"context"
	"fmt"
	"net"

	"github.com/school-crm/payment-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── Hand-rolled proto types (replace with buf-generated when protos published) ─

type GetPaymentRequest struct{ PaymentID string }
type GetPaymentResponse struct {
	ID            string  `json:"id"`
	StudentID     string  `json:"student_id"`
	Amount        float64 `json:"amount"`
	Month         string  `json:"month"`
	Year          int32   `json:"year"`
	PaymentMethod string  `json:"payment_method"`
	Status        string  `json:"status"`
	BranchID      string  `json:"branch_id"`
}

type ListPaymentsRequest struct {
	BranchID string
	Month    string
	Year     int32
	Status   string
	Page     int32
	Limit    int32
	Cursor   string
}
type ListPaymentsResponse struct {
	Items      []*GetPaymentResponse
	Total      int32
	NextCursor string
}

type CheckSubscriptionRequest struct {
	StudentID string
	BranchID  string
}
type CheckSubscriptionResponse struct {
	Active bool
	PlanID string
}

// ── gRPC server ───────────────────────────────────────────────────────────────

type PaymentGRPCServer struct {
	svc  *service.PaymentService
	grpc *grpc.Server
}

func NewPaymentGRPCServer(svc *service.PaymentService) *PaymentGRPCServer {
	s := &PaymentGRPCServer{
		svc:  svc,
		grpc: grpc.NewServer(),
	}
	// When buf-generated stubs are available:
	// paymentv1.RegisterPaymentServiceServer(s.grpc, s)
	return s
}

// GetPayment retrieves a single payment by ID.
func (s *PaymentGRPCServer) GetPayment(ctx context.Context, req *GetPaymentRequest) (*GetPaymentResponse, error) {
	p, err := s.svc.GetByID(ctx, req.PaymentID)
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "payment %s not found", req.PaymentID)
		}
		return nil, status.Errorf(codes.Internal, "get payment: %v", err)
	}
	return &GetPaymentResponse{
		ID:            p.ID,
		StudentID:     p.StudentID,
		Amount:        p.Amount,
		Month:         p.Month,
		Year:          int32(p.Year),
		PaymentMethod: p.PaymentMethod,
		Status:        p.Status,
		BranchID:      p.BranchID,
	}, nil
}

// ListPayments returns a filtered, paginated list of payments.
func (s *PaymentGRPCServer) ListPayments(ctx context.Context, req *ListPaymentsRequest) (*ListPaymentsResponse, error) {
	yearStr := ""
	if req.Year > 0 {
		yearStr = fmt.Sprintf("%d", req.Year)
	}

	resp, err := s.svc.List(ctx, service.ListFilter{
		BranchID: req.BranchID,
		Month:    req.Month,
		Year:     yearStr,
		Status:   req.Status,
		Cursor:   req.Cursor,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list payments: %v", err)
	}

	items := make([]*GetPaymentResponse, 0, len(resp.Items))
	for _, p := range resp.Items {
		items = append(items, &GetPaymentResponse{
			ID:            p.ID,
			StudentID:     p.StudentID,
			Amount:        p.Amount,
			Month:         p.Month,
			Year:          int32(p.Year),
			PaymentMethod: p.PaymentMethod,
			Status:        p.Status,
			BranchID:      p.BranchID,
		})
	}
	return &ListPaymentsResponse{
		Items:      items,
		Total:      int32(resp.Total),
		NextCursor: resp.NextCursor,
	}, nil
}

// CheckSubscriptionActive returns whether a student has an active subscription.
// Used by other services (e.g. student_service, notification_service) to check access.
func (s *PaymentGRPCServer) CheckSubscriptionActive(ctx context.Context, req *CheckSubscriptionRequest) (*CheckSubscriptionResponse, error) {
	active, planID, err := s.svc.HasActiveSubscription(ctx, req.BranchID, req.StudentID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "check subscription: %v", err)
	}
	return &CheckSubscriptionResponse{Active: active, PlanID: planID}, nil
}

// Serve starts listening on addr and blocks until the server stops.
func (s *PaymentGRPCServer) Serve(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return s.grpc.Serve(lis)
}

// GracefulStop stops the gRPC server gracefully.
func (s *PaymentGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
