import React from 'react';
import { Project } from '../../services/api';

interface MobileProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

const MobileProjectSelector: React.FC<MobileProjectSelectorProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
}) => {
  return (
    <div className="mobile-project-selector">
      <label htmlFor="project-select" className="selector-label">
        프로젝트 선택
      </label>
      <div className="selector-wrapper">
        <select
          id="project-select"
          value={selectedProjectId}
          onChange={(e) => onProjectChange(e.target.value)}
          className="project-select"
        >
          <option value="all">전체 프로젝트</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name || project.id}
            </option>
          ))}
        </select>
        <svg className="select-arrow" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
        </svg>
      </div>
    </div>
  );
};

export default MobileProjectSelector;