// Package grpc implements the StudentService gRPC server.
// Hand-rolled proto types until buf-generated stubs are published.
package grpc

import (
	"context"
	"fmt"
	"net"

	"github.com/school-crm/student-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── Hand-rolled proto types ───────────────────────────────────────────────────

type GetStudentRequest struct{ StudentID string }
type GetStudentResponse struct {
	ID             string
	FullName       string
	Phone          string
	ClassID        string
	BranchID       string
	MonthlyPayment float64
	Status         string
}

type ListStudentsRequest struct {
	BranchID string
	ClassID  string
	Status   string
	Cursor   string
	Limit    int32
}
type ListStudentsResponse struct {
	Items      []*GetStudentResponse
	Total      int32
	NextCursor string
}

type GetClassRequest struct{ ClassID string }
type GetClassResponse struct {
	ID        string
	Name      string
	TeacherID string
	BranchID  string
}

type ListClassesRequest struct{ BranchID string }
type ListClassesResponse struct{ Items []*GetClassResponse }

type GetTeacherClassesRequest struct{ TeacherID string }

// ── Server ────────────────────────────────────────────────────────────────────

type StudentGRPCServer struct {
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
	return s
}

// GetStudent returns student data by ID.
// Called by payment_service when displaying payment records with student names.
func (s *StudentGRPCServer) GetStudent(ctx context.Context, req *GetStudentRequest) (*GetStudentResponse, error) {
	st, err := s.students.GetByID(ctx, req.StudentID)
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "student %s not found", req.StudentID)
		}
		return nil, status.Errorf(codes.Internal, "get student: %v", err)
	}
	resp := &GetStudentResponse{
		ID:             st.ID,
		FullName:       st.FullName,
		Phone:          st.Phone,
		BranchID:       st.BranchID,
		MonthlyPayment: st.MonthlyPayment,
		Status:         st.Status,
	}
	if st.ClassID != nil {
		resp.ClassID = *st.ClassID
	}
	return resp, nil
}

// ListStudents returns a paginated list of students for a branch.
func (s *StudentGRPCServer) ListStudents(ctx context.Context, req *ListStudentsRequest) (*ListStudentsResponse, error) {
	limit := "20"
	if req.Limit > 0 {
		limit = fmt.Sprintf("%d", req.Limit)
	}
	resp, err := s.students.List(ctx, service.ListFilter{
		BranchID: req.BranchID,
		ClassID:  req.ClassID,
		Status:   req.Status,
		Cursor:   req.Cursor,
		Limit:    limit,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list students: %v", err)
	}

	items := make([]*GetStudentResponse, 0, len(resp.Items))
	for _, st := range resp.Items {
		r := &GetStudentResponse{
			ID: st.ID, FullName: st.FullName, Phone: st.Phone,
			BranchID: st.BranchID, MonthlyPayment: st.MonthlyPayment, Status: st.Status,
		}
		if st.ClassID != nil {
			r.ClassID = *st.ClassID
		}
		items = append(items, r)
	}
	return &ListStudentsResponse{Items: items, Total: int32(resp.Total), NextCursor: resp.NextCursor}, nil
}

// GetClass returns class metadata by ID.
func (s *StudentGRPCServer) GetClass(ctx context.Context, req *GetClassRequest) (*GetClassResponse, error) {
	cl, err := s.classes.GetByID(ctx, req.ClassID)
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "class %s not found", req.ClassID)
		}
		return nil, status.Errorf(codes.Internal, "get class: %v", err)
	}
	resp := &GetClassResponse{ID: cl.ID, Name: cl.Name, BranchID: cl.BranchID}
	if cl.TeacherID != nil {
		resp.TeacherID = *cl.TeacherID
	}
	return resp, nil
}

// ListClasses returns all classes for a branch.
// Called by teacher_service to populate teacher portal.
func (s *StudentGRPCServer) ListClasses(ctx context.Context, req *ListClassesRequest) (*ListClassesResponse, error) {
	classes, err := s.classes.GetAll(ctx, req.BranchID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list classes: %v", err)
	}
	items := make([]*GetClassResponse, 0, len(classes))
	for _, cl := range classes {
		r := &GetClassResponse{ID: cl.ID, Name: cl.Name, BranchID: cl.BranchID}
		if cl.TeacherID != nil {
			r.TeacherID = *cl.TeacherID
		}
		items = append(items, r)
	}
	return &ListClassesResponse{Items: items}, nil
}

// GetTeacherClasses returns all classes assigned to a specific teacher.
func (s *StudentGRPCServer) GetTeacherClasses(ctx context.Context, req *GetTeacherClassesRequest) (*ListClassesResponse, error) {
	classes, err := s.classes.GetByTeacherID(ctx, req.TeacherID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "teacher classes: %v", err)
	}
	items := make([]*GetClassResponse, 0, len(classes))
	for _, cl := range classes {
		r := &GetClassResponse{ID: cl.ID, Name: cl.Name, BranchID: cl.BranchID}
		if cl.TeacherID != nil {
			r.TeacherID = *cl.TeacherID
		}
		items = append(items, r)
	}
	return &ListClassesResponse{Items: items}, nil
}

func (s *StudentGRPCServer) Serve(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return s.grpc.Serve(lis)
}

func (s *StudentGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
