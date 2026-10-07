import { forwardRef } from 'react';
import type { Course } from '../domain/course';
import { elementEnds, isSinglePole } from '../domain/geometry';

interface Props {
  course: Course;
  markedGates?: number[];
}

const CoursePlanStatic = forwardRef<SVGSVGElement, Props>(function CoursePlanStatic(
  { course, markedGates = [] },
  ref,
) {
  const pad = 4;
  return (
    <svg
      ref={ref}
      xmlns='http://www.w3.org/2000/svg'
      viewBox={`${-pad} ${-pad} ${course.width + pad * 2} ${course.length + pad * 2}`}
      role='img'
      aria-label='Course plan'
      className='max-h-[480px] w-full'
    >
      <rect x={-pad} y={-pad} width={course.width + pad * 2} height={course.length + pad * 2} fill='#ffffff' />
      <rect x={0} y={0} width={course.width} height={course.length} fill='#e0f2fe' stroke='#475569' strokeWidth={0.12} />
      {course.elements.map((el) => {
        const [a, b] = elementEnds(el);
        const single = isSinglePole(el);
        const marked = el.number !== null && markedGates.includes(el.number);
        return (
          <g key={el.id}>
            {el.type === 'hazard' ? (
              <rect
                x={-el.width / 2}
                y={-el.width / 4}
                width={el.width}
                height={el.width / 2}
                transform={`translate(${el.x} ${el.y}) rotate(${el.rotationDeg})`}
                fill={el.colour}
                fillOpacity={0.3}
                stroke={el.colour}
                strokeWidth={0.1}
              />
            ) : single ? (
              <circle cx={el.x} cy={el.y} r={0.3} fill={el.colour} />
            ) : (
              <>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={el.colour} strokeWidth={0.18} strokeLinecap='round' />
                <circle cx={a.x} cy={a.y} r={0.22} fill={el.colour} />
                <circle cx={b.x} cy={b.y} r={0.22} fill={el.colour} />
              </>
            )}
            {marked && <circle cx={el.x} cy={el.y} r={1.2} fill='none' stroke='#f97316' strokeWidth={0.2} />}
            {el.number !== null && (
              <text x={el.x} y={el.y - 0.7} fontSize={0.9} textAnchor='middle' fill='#0f172a'>
                {el.number}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

export default CoursePlanStatic;
