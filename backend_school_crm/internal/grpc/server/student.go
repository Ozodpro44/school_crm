package server

import (
	"context"

	"github.com/school-crm/backend/internal/models"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
	"github.com/school-crm/backend/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// StudentServer implements pb.StudentServiceServer.
type StudentServer struct {
	pb.UnimplementedStudentServiceServer
	svc *service.StudentService
}

// NewStudentServer creates a StudentServer.
func NewStudentServer(svc *service.StudentService) *StudentServer {
	return &StudentServer{svc: svc}
}

func (s *StudentServer) ListStudents(ctx context.Context, req *pb.ListStudentsRequest) (*pb.ListStudentsResponse, error) {
	page := int(req.Page)
	limit := int(req.Limit)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 1000 {
		limit = 10
	}

	students, total, err := s.svc.GetByBranchID(ctx, req.BranchId, page, limit)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list students: %v", err)
	}

	items := make([]*pb.Student, 0, len(students))
	for _, st := range students {
		items = append(items, studentModelToProto(st))
	}

	return &pb.ListStudentsResponse{
		Items: items,
		Total: total,
		Page:  int32(page),
		Limit: int32(limit),
	}, nil
}

func (s *StudentServer) GetStudent(ctx context.Context, req *pb.GetStudentRequest) (*pb.Student, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	st, err := s.svc.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "student not found: %v", err)
	}
	return studentModelToProto(*st), nil
}

func (s *StudentServer) CreateStudent(ctx context.Context, req *pb.CreateStudentRequest) (*pb.Student, error) {
	svcReq := &service.CreateStudentRequest{
		FullName:       req.FullName,
		MonthlyPayment: req.MonthlyPayment,
		Status:         req.Status,
		BranchID:       req.BranchId,
	}
	if req.ClassId != "" {
		svcReq.ClassID = &req.ClassId
	}
	if req.Phone != "" {
		svcReq.Phone = &req.Phone
	}
	if req.ParentPhone != "" {
		svcReq.ParentPhone = &req.ParentPhone
	}

	st, err := s.svc.Create(ctx, svcReq)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "create student: %v", err)
	}
	return studentModelToProto(*st), nil
}

func (s *StudentServer) UpdateStudent(ctx context.Context, req *pb.UpdateStudentRequest) (*pb.Student, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["fullName"] = req.FullName
	}
	if req.ClassId != "" {
		updates["classId"] = req.ClassId
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.ParentPhone != "" {
		updates["parentPhone"] = req.ParentPhone
	}
	if req.MonthlyPayment > 0 {
		updates["monthlyPayment"] = req.MonthlyPayment
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	st, err := s.svc.Update(ctx, req.Id, updates)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "update student: %v", err)
	}
	return studentModelToProto(*st), nil
}

func (s *StudentServer) DeleteStudent(ctx context.Context, req *pb.DeleteStudentRequest) (*pb.DeleteStudentResponse, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	if err := s.svc.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "delete student: %v", err)
	}
	return &pb.DeleteStudentResponse{Success: true}, nil
}

// StudentModelToProtoExported is the exported version for testing.
var StudentModelToProtoExported = studentModelToProto

// studentModelToProto converts a models.Student to *pb.Student.
func studentModelToProto(st models.Student) *pb.Student {
	p := &pb.Student{
		Id:             st.ID,
		FullName:       st.FullName,
		ClassId:        st.ClassID,
		Phone:          st.Phone,
		ParentPhone:    st.ParentPhone,
		MonthlyPayment: st.MonthlyPayment,
		Status:         string(st.Status),
		BranchId:       st.BranchID,
		CreatedAt:      timestamppb.New(st.CreatedAt),
		UpdatedAt:      timestamppb.New(st.UpdatedAt),
	}
	if st.EnrollmentDate != nil {
		p.EnrollmentDate = timestamppb.New(*st.EnrollmentDate)
	}
	if st.LeftDate != nil {
		p.LeftDate = timestamppb.New(*st.LeftDate)
	}
	return p
}
