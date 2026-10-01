import { useState } from 'react'
import type { CatalogCourse, CatalogSemester } from '../types/courseCatalog'
import type { AcademicTerm, ScheduleCourse } from '../types/schedule'
import CourseCatalogBrowser from './CourseCatalogBrowser'
import CourseScheduleForm from './CourseScheduleForm'

type CourseFormModalProps = {
  initialTerm: AcademicTerm
  initialCourse?: ScheduleCourse
  courses: ScheduleCourse[]
  onClose: () => void
  onSave: (course: ScheduleCourse) => void
  onDelete?: (courseId: string) => void
}

type AddView = 'catalog' | 'direct' | 'schedule'

function CourseFormModal(props: CourseFormModalProps) {
  const [view, setView] = useState<AddView>(props.initialCourse ? 'schedule' : 'catalog')
  const [selected, setSelected] = useState<{ course: CatalogCourse; semester: CatalogSemester } | null>(null)

  return (
    <div className="schedule-modal-overlay" role="presentation" onMouseDown={props.onClose}>
      <div className="schedule-modal-stop" onMouseDown={(event) => event.stopPropagation()}>
        {view === 'catalog' && (
          <CourseCatalogBrowser
            initialSemester={props.initialTerm}
            onClose={props.onClose}
            onDirectAdd={() => setView('direct')}
            onSelect={(course, semester) => {
              setSelected({ course, semester })
              setView('schedule')
            }}
          />
        )}
        {(view === 'direct' || view === 'schedule') && (
          <CourseScheduleForm
            {...props}
            catalogCourse={selected?.course}
            catalogSemester={selected?.semester ?? props.initialTerm}
            onBack={!props.initialCourse ? () => setView('catalog') : undefined}
          />
        )}
      </div>
    </div>
  )
}

export default CourseFormModal
