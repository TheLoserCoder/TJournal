// Intentional violation: a View must not reach the renderer gateway.
import { createRendererGateway } from '../../gateway/renderer-gateway';

export const gateway = createRendererGateway;
