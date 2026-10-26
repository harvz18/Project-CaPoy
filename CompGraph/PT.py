import pygame
from OpenGL.GL import *
from OpenGL.GLU import gluPerspective


SIZE = (500, 650)


def draw_sprite():
    # Left Hand
    glColor3f(0.72, 0.72, 0.72)
    glBegin(GL_QUADS)
    glVertex2f(-0.52, 0.1)   # H1
    glVertex2f(-0.7, -0.1)   # I1
    glVertex2f(-0.7, -0.9)   # J1
    glVertex2f(-0.52, -0.9)  # K1
    glEnd()

    # Right Hand
    glColor3f(0.72, 0.72, 0.72)
    glBegin(GL_QUADS)
    glVertex2f(0.52, 0.1)   # L1
    glVertex2f(0.7, -0.1)   # M1
    glVertex2f(0.7, -0.9)   # N1
    glVertex2f(0.52, -0.9)  # O1
    glEnd()

    # Left foot
    glColor3f(0.2, 0.2, 0.2)
    glBegin(GL_POLYGON)
    glVertex2f(-0.4, -1.4)    # T
    glVertex2f(-0.36, -1.32)  # U
    glVertex2f(-0.14, -1.32)  # V
    glVertex2f(-0.1, -1.4)    # W
    glVertex2f(-0.1, -1.5)    # Z
    glVertex2f(-0.4, -1.5)    # A1
    glEnd()

    # Right foot
    glColor3f(0.2, 0.2, 0.2)
    glBegin(GL_POLYGON)
    glVertex2f(0.1, -1.5)    # B1
    glVertex2f(0.1, -1.4)    # C1
    glVertex2f(0.14, -1.32)  # D1
    glVertex2f(0.36, -1.32)  # E1
    glVertex2f(0.4, -1.4)    # F1
    glVertex2f(0.4, -1.5)    # G1
    glEnd()

    # Body
    glColor3f(0.18, 0.57, 0.54)
    glBegin(GL_TRIANGLE_FAN)
    glVertex2f(0.0, 0.0)
    glVertex2f(-0.16, 0.8)   # E
    glVertex2f(-0.16, 0.6)   # F
    glVertex2f(-0.4, 0.4)    # G
    glVertex2f(-0.52, 0.2)   # H
    glVertex2f(-0.52, -1.0)  # I
    glVertex2f(-0.44, -1.2)  # J
    glVertex2f(-0.2, -1.32)  # K
    glVertex2f(0.0, -1.28)   # L
    glVertex2f(0.2, -1.32)   # M
    glVertex2f(0.44, -1.2)   # N
    glVertex2f(0.52, -1.0)   # O
    glVertex2f(0.52, 0.2)    # P
    glVertex2f(0.4, 0.4)     # Q
    glVertex2f(0.16, 0.6)    # R
    glVertex2f(0.16, 0.8)    # S
    glVertex2f(-0.16, 0.8)
    glEnd()

    # Head
    glColor3f(0.72, 0.72, 0.72)
    glBegin(GL_QUADS)
    glVertex2f(-0.2, 1.0)  # A
    glVertex2f(-0.2, 0.8)  # B
    glVertex2f(0.2, 0.8)   # C
    glVertex2f(0.2, 1.0)   # D
    glEnd()


def main():
    pygame.init()
    pygame.display.set_mode(SIZE, pygame.DOUBLEBUF | pygame.OPENGL)

    glClearColor(1, 1, 1, 1)

    glMatrixMode(GL_PROJECTION)
    gluPerspective(45, SIZE[0] / SIZE[1], 0.1, 50)
    glMatrixMode(GL_MODELVIEW)

    character_x, character_z, angle = 0.0, -4.0, 0
    clock = pygame.time.Clock()

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RIGHT:
                    character_x += 0.2
                    angle = 15
                elif event.key == pygame.K_LEFT:
                    character_x -= 0.2
                    angle = -15
                elif event.key == pygame.K_UP:
                    character_z -= 0.2
                    angle = 0
                elif event.key == pygame.K_DOWN:
                    character_z += 0.2
                    angle = 0

        glClear(GL_COLOR_BUFFER_BIT)
        glLoadIdentity()
        glTranslatef(character_x, 0.25, character_z)
        glRotatef(angle, 0, 1, 0)
        draw_sprite()
        pygame.display.flip()
        clock.tick(60)


if __name__ == "__main__":
    main()
