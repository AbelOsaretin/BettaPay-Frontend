import React from 'react';
import DOMPurify from 'isomorphic-dompurify';

interface SafeHtmlRendererProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string;
}

export function SafeHtmlRenderer({ html, ...props }: SafeHtmlRendererProps) {
  const sanitizedHtml = DOMPurify.sanitize(html);

  return (
    <div
      {...props}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
