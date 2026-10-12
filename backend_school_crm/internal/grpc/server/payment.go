package server

import (
	"context"
	"fmt"

	"github.com/school-crm/backend/internal/models"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
	"github.com/school-crm/backend/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// PaymentServer implements pb.PaymentServiceServer.
type PaymentServer struct {
	pb.UnimplementedPaymentServiceServer
	svc       *service.PaymentService
	branchSvc *service.BranchService
}

// NewPaymentServer creates a PaymentServer.
func NewPaymentServer(svc *service.PaymentService, branchSvc *service.BranchService) *PaymentServer {
	return &PaymentServer{svc: svc, branchSvc: branchSvc}
}

func (s *PaymentServer) ListPayments(ctx context.Context, req *pb.ListPaymentsRequest) (*pb.ListPaymentsResponse, error) {
	page := int(req.Page)
	limit := int(req.Limit)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 10000 {
		limit = 10
	}

	month := req.Month
	year := int(req.Year)
	if month == "" || year == 0 {
		cm, cy, err := s.branchSvc.GetCurrentMonth(ctx, req.BranchId)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "get current month: %v", err)
		}
		if month == "" {
			month = cm
		}
		if year == 0 {
			year = cy
		}
	}

	result, err := s.svc.GetByBranchIDAndPeriodPaginatedWithSearch(
		ctx, req.BranchId, month, fmt.Sprintf("%d", year), req.Search, req.Status, page, limit,
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list payments: %v", err)
	}

	// result is map[string]interface{}
	var payments []models.Payment
	if data, ok := result["data"].([]models.Payment); ok {
		payments = data
	}
	totalInt64, _ := result["total"].(int64)

	items := make([]*pb.Payment, 0, len(payments))
	for _, p := range payments {
		items = append(items, paymentModelToProto(p))
	}

	return &pb.ListPaymentsResponse{
		Items: items,
		Total: totalInt64,
		Page:  int32(page),
		Limit: int32(limit),
	}, nil
}

func (s *PaymentServer) GetPayment(ctx context.Context, req *pb.GetPaymentRequest) (*pb.Payment, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	p, err := s.svc.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "payment not found: %v", err)
	}
	return paymentModelToProto(*p), nil
}

func (s *PaymentServer) CreatePayment(ctx context.Context, req *pb.CreatePaymentRequest) (*pb.Payment, error) {
	// Validate against branch current month
	currentMonth, currentYear, err := s.branchSvc.GetCurrentMonth(ctx, req.BranchId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "get current month: %v", err)
	}
	if req.Month != currentMonth || int(req.Year) != currentYear {
		return nil, status.Errorf(codes.InvalidArgument,
			"can only create payments for current month (%s/%d)", currentMonth, currentYear)
	}

	svcReq := &service.CreatePaymentRequest{
		StudentID:     req.StudentId,
		Amount:        req.Amount,
		Month:         req.Month,
		Year:          int(req.Year),
		PaymentMethod: req.PaymentMethod,
		Status:        req.Status,
		InvoiceNumber: req.InvoiceNumber,
		BranchID:      req.BranchId,
	}
	if req.Notes != "" {
		svcReq.Notes = &req.Notes
	}

	p, err := s.svc.Create(ctx, svcReq, "grpc")
	if err != nil {
		return nil, status.Errorf(codes.Internal, "create payment: %v", err)
	}
	return paymentModelToProto(*p), nil
}

func (s *PaymentServer) DeletePayment(ctx context.Context, req *pb.DeletePaymentRequest) (*pb.DeletePaymentResponse, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	if err := s.svc.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "delete payment: %v", err)
	}
	return &pb.DeletePaymentResponse{Success: true}, nil
}

// PaymentModelToProtoExported is the exported version for testing.
var PaymentModelToProtoExported = paymentModelToProto

// paymentModelToProto converts a models.Payment to *pb.Payment.
func paymentModelToProto(p models.Payment) *pb.Payment {
	proto := &pb.Payment{
		Id:            p.ID,
		StudentId:     p.StudentID,
		Amount:        p.Amount,
		Month:         p.Month,
		Year:          int32(p.Year),
		PaymentMethod: string(p.PaymentMethod),
		Status:        string(p.Status),
		InvoiceNumber: p.InvoiceNumber,
		BranchId:      p.BranchID,
		CreatedAt:     timestamppb.New(p.CreatedAt),
	}
	if p.Notes != nil {
		proto.Notes = *p.Notes
	}
	if p.CreatedBy != nil {
		proto.CreatedBy = *p.CreatedBy
	}
	if p.PaidDate != nil {
		proto.PaidDate = timestamppb.New(*p.PaidDate)
	}
	return proto
}
