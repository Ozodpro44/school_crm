// Package grpc implements the StudentService gRPC server defined in
// protos/student/v1/student.proto. The generated stubs are now compiled in
// (see protos/go.mod) and actually registered — previously this package
// defined a parallel hand-rolled interface (with extra RPCs like GetClass/
// ListClasses/GetTeacherClasses that aren't part of the committed proto
// contract at all) that was never registered with the underlying
// grpc.Server, so the server accepted TCP connections but answered every
// real RPC with Unimplemented.
//
// Only the three RPCs actually defined in student.proto are implemented
// here (GetStudent, ListStudents, GetActiveStudentCount). The class-lookup
// helpers the old hand-rolled version had are still available as plain Go
// methods on ClassService for in-process/REST use — they just aren't
// exposed over this gRPC surface, since nothing in the proto contract or
// any real caller depends on them being there.
package grpc

import (
	"context"
	"fmt"
	"net"

	studentv1 "github.com/school-crm/protos/student/v1"

	commonv1 "github.com/school-crm/protos/common/v1"
	"github.com/school-crm/student-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type StudentGRPCServer struct {
	studentv1.UnimplementedStudentServiceServer
	students *service.StudentService
	classes  *service.ClassService
	grpc     *grpc.Server
}

func NewStudentGRPCServer(students *service.StudentService, classes *service.ClassService) *StudentGRPCServer {
	s := &StudentGRPCServer{
		students: students,
		classes:  classes,
		grpc:     grpc.NewServer(),
	}
	studentv1.RegisterStudentServiceServer(s.grpc, s)
	return s
}

func toProtoStudent(st *service.Student) *studentv1.Student {
	p := &studentv1.Student{
		StudentId:      st.ID,
		FullName:       st.FullName,
		Phone:          st.Phone,
		ParentPhone:    st.ParentPhone,
		ClassName:      st.ClassName,
		MonthlyPayment: st.MonthlyPayment,
		Status:         st.Status,
		BranchId:       st.BranchID,
		CreatedAt:      timestamppb.New(st.CreatedAt),
	}
	if st.ClassID != nil {
		p.ClassId = *st.ClassID
	}
	if st.EnrollmentDate != nil {
		p.EnrollmentDate = timestamppb.New(*st.EnrollmentDate)
	}
	return p
}

// GetStudent returns student data by ID.
// Called by payment_service when displaying payment records with student names.
func (s *StudentGRPCServer) GetStudent(ctx context.Context, req *studentv1.GetStudentRequest) (*studentv1.GetStudentResponse, error) {
	st, err := s.students.GetByID(ctx, req.GetStudentId())
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "student %s not found", req.GetStudentId())
		}
		return nil, status.Errorf(codes.Internal, "get student: %v", err)
	}
	return &studentv1.GetStudentResponse{Student: toProtoStudent(st)}, nil
}

// ListStudents returns a paginated list of students for a branch, plus the
// branch's classes (per the proto's response shape).
func (s *StudentGRPCServer) ListStudents(ctx context.Context, req *studentv1.ListStudentsRequest) (*studentv1.ListStudentsResponse, error) {
	limit := "20"
	page := ""
	cursor := ""
	if p := req.GetPage(); p != nil {
		if p.GetLimit() > 0 {
			limit = fmt.Sprintf("%d", p.GetLimit())
		}
		if p.GetPage() > 0 {
			page = fmt.Sprintf("%d", p.GetPage())
		}
		cursor = p.GetCursor()
	}

	resp, err := s.students.List(ctx, service.ListFilter{
		BranchID: req.GetBranchId(),
		ClassID:  req.GetClassId(),
		Status:   req.GetStatus(),
		Search:   req.GetSearch(),
		Page:     page,
		Limit:    limit,
		Cursor:   cursor,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list students: %v", err)
	}

	students := make([]*studentv1.Student, 0, len(resp.Items))
	for i := range resp.Items {
		students = append(students, toProtoStudent(&resp.Items[i]))
	}

	classes, err := s.classes.GetAll(ctx, req.GetBranchId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list classes: %v", err)
	}
	protoClasses := make([]*studentv1.Class, 0, len(classes))
	for _, cl := range classes {
		c := &studentv1.Class{
			ClassId:      cl.ID,
			Name:         cl.Name,
			BranchId:     cl.BranchID,
			StudentCount: int32(cl.StudentCount),
		}
		if cl.TeacherID != nil {
			c.TeacherId = *cl.TeacherID
		}
		protoClasses = append(protoClasses, c)
	}

	return &studentv1.ListStudentsResponse{
		Students: students,
		Classes:  protoClasses,
		Page: &commonv1.PageResponse{
			Total:      int32(resp.Total),
			NextCursor: resp.NextCursor,
		},
	}, nil
}

// GetActiveStudentCount returns the number of active students in a branch.
func (s *StudentGRPCServer) GetActiveStudentCount(ctx context.Context, req *studentv1.GetActiveStudentCountRequest) (*studentv1.GetActiveStudentCountResponse, error) {
	count, err := s.students.CountActive(ctx, req.GetBranchId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "count active students: %v", err)
	}
	return &studentv1.GetActiveStudentCountResponse{Count: int32(count)}, nil
}

func (s *StudentGRPCServer) Serve(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return s.grpc.Serve(lis)
}

func (s *StudentGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
