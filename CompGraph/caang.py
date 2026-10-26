import pygame
from pygame.locals import *

from OpenGL.GL import *
from OpenGL.GLU import *

# 1 STAR
def Star():
    glBegin(GL_LINES)

    glVertex2f(0, 2)
    glVertex2f(-1.18, -1.62)

    glVertex2f(-1.18, -1.62)
    glVertex2f(1.90, 0.62)

    glVertex2f(1.90, 0.62)
    glVertex2f(-1.90, 0.62)

    glVertex2f(-1.90, 0.62)
    glVertex2f(1.18, -1.62)

    glVertex2f(1.18, -1.62)
    glVertex2f(0, 2)
    glEnd()


# 2 CROSS
def cross():
    glBegin(GL_LINES)

    glVertex2f(-1, 1)
    glVertex2f(1, -1)

    glVertex2f(1, 1)
    glVertex2f(-1, -1)

    glEnd()


# 3 CROSSBOX
def crossbox():
    glBegin(GL_LINES)
    
    glVertex2f(-1, 1)
    glVertex2f(1, -1)
    
    glVertex2f(1, 1)
    glVertex2f(-1, -1)

    glVertex2f(-1, 1)
    glVertex2f(1, 1)
        
    glVertex2f(1, 1)
    glVertex2f(1, -1)

    glVertex2f(1, -1)
    glVertex2f(-1, -1)
        
    glVertex2f(-1, -1)
    glVertex2f(-1, 1)

    glEnd()


# 4 diamond
def diamond():
    glBegin(GL_LINES)

    glVertex2f(0, 1)
    glVertex2f(1, 0)

    glVertex2f(1, 0)
    glVertex2f(0, -1)

    glVertex2f(0, -1)
    glVertex2f(-1, 0)

    glVertex2f(-1, 0)
    glVertex2f(0, 1)

    glEnd()


# 5 Ribbon
def ribbon():
    glBegin(GL_LINES)
        
    glVertex2f(-1, 1)
    glVertex2f(1, -1)
        
    glVertex2f(1, 1)
    glVertex2f(-1, -1)
    
    # glVertex2f(-1, 1)
    # glVertex2f(1, 1)
            
    glVertex2f(1, 1)
    glVertex2f(1, -1)
    
    # glVertex2f(1, -1)
    # glVertex2f(-1, -1)
            
    glVertex2f(-1, -1)
    glVertex2f(-1, 1)
    
    glEnd()
    
def main():
    pygame.init()
    display = (800, 600)
    pygame.display.set_mode(display, DOUBLEBUF | OPENGL)
    gluPerspective(75, (display[0] / display[1]), 0.1, 50.0)
    glTranslatef(0.0, 0.0, -5)

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
        # Star()
        # cross()
        # crossbox()
        # diamond()
        ribbon()
        pygame.display.flip()

main()