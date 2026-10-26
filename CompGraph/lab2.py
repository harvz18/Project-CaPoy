import pygame
from pygame.locals import *

from OpenGL.GL import *
from OpenGL.GLU import *

def drawSquare():
    glBegin(GL_QUADS)
    glVertex2f(-1, 1)
    glVertex2f(1, 1)
    glVertex2f(1, -1)
    glVertex2f(-1, -1)
    glEnd()

def drawTriangle():
    glBegin(GL_TRIANGLES)
    glVertex2f(-1, -1)
    glVertex2f(1, -1)
    glVertex2f(0, 1)
    glEnd()

def drawDiamond():
    glBegin(GL_QUADS)
    glVertex2f(0, 1)
    glVertex2f(1, 0)
    glVertex2f(0, -1)
    glVertex2f(-1, 0)
    glEnd()

def drawPentagon():
    glBegin(GL_POLYGON)
    glVertex2f(0, 1)
    glVertex2f(0.951, 0.309)
    glVertex2f(0.588, -0.809)
    glVertex2f(-0.588, -0.809)
    glVertex2f(-0.951, 0.309)
    glEnd()

def main():
    pygame.init()
    display = (800, 600)
    pygame.display.set_mode(display, DOUBLEBUF | OPENGL)
    glMatrixMode(GL_PROJECTION)
    gluPerspective(75, (display[0] / display[1]), 0.1, 50.0)
    glMatrixMode(GL_MODELVIEW)
    glTranslatef(0.0, 0.0, -5)

    shape = "square"
    

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT:
                    shape = "square"
                elif event.key == pygame.K_RIGHT:
                    shape = "triangle"
                elif event.key == pygame.K_UP:
                    shape = "diamond"
                elif event.key == pygame.K_DOWN:
                    shape = "pentagon"
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        if shape == "square":
            drawSquare()
        if shape == "triangle":
            drawTriangle()
        if shape == "diamond":
            drawDiamond()
        if shape == "pentagon":
            drawPentagon()
        # drawSquare()
        # drawTriangle()
        # drawDiamond()
        # drawPentagon()
        pygame.display.flip()

main()